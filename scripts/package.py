from pathlib import Path
import argparse, json, shutil, zipfile, hashlib, re

root = Path(__file__).resolve().parents[1]
release = root / 'release'
parser = argparse.ArgumentParser(description='Build and verify release archives from dist/')
parser.add_argument('--tag', default='', help='Expected release tag, e.g. v1.5.30')
args = parser.parse_args()
version = json.loads((root / 'manifest.json').read_text(encoding='utf-8'))['version']
if not re.fullmatch(r'\d+\.\d+\.\d+', version):
    raise SystemExit('Release version must have three numeric components')
package = json.loads((root / 'package.json').read_text(encoding='utf-8'))
lock = json.loads((root / 'package-lock.json').read_text(encoding='utf-8'))
built = json.loads((root / 'dist/manifest.json').read_text(encoding='utf-8'))
if any(v != version for v in [package['version'], lock['version'], lock['packages']['']['version'], built['version']]):
    raise SystemExit('Version mismatch between manifest, package, lock or built extension; rebuild first')
if args.tag and args.tag != f'v{version}':
    raise SystemExit(f'Tag {args.tag} does not match v{version}')
release.mkdir(exist_ok=True)
bundle = release / f'enhanced-23mofang-v{version}'
bundle.mkdir(exist_ok=True)
shutil.copytree(root / 'dist', bundle / 'extension', dirs_exist_ok=True)
shutil.copy2(root / 'README.md', bundle / '安装与使用说明.md')
shutil.copy2(root / 'VALIDATION.md', bundle / '验证记录.md')
shutil.copy2(root / 'assets' / 'region-coverage.md', bundle / '行政区域补图核查.md')
shutil.copy2(root / 'assets' / 'letter-node-audit.md', bundle / '字母父系节点核查.md')
shutil.copy2(root / 'assets' / 'sample-sources.md', bundle / '多源公开样本说明.md')
shutil.copy2(root / 'assets' / 'mofang-snp-exploration.md', bundle / '23魔方SNP查询探索说明.md')
shutil.copy2(root / 'assets' / 'yfull-letter-node-audit.md', bundle / 'YFull字母根节点核查.md')
shutil.copy2(root / 'LICENSE', bundle / 'LICENSE')
# Keep case-specific research in the source archive, not the installer.
# Remove files left by an earlier packaging run of the same version.
for name in ['YFull异名节点核查.md', 'yfull-b482-audit.json']:
    (bundle / name).unlink(missing_ok=True)

installer = release / f'enhanced-23mofang-v{version}-installer.zip'
with zipfile.ZipFile(installer, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    # Enumerate current inputs, never stale files left in a previous staging folder.
    for p in sorted((root / 'dist').rglob('*')):
        if p.is_file():
            z.write(p, Path('extension') / p.relative_to(root / 'dist'))
    for name in ['安装与使用说明.md', '验证记录.md', '行政区域补图核查.md', '字母父系节点核查.md', '多源公开样本说明.md', '23魔方SNP查询探索说明.md', 'YFull字母根节点核查.md', 'LICENSE']:
        z.write(bundle / name, name)

source = release / f'enhanced-23mofang-v{version}-source.zip'
with zipfile.ZipFile(source, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for name in ['package.json', 'package-lock.json', 'tsconfig.json', 'manifest.json', '.gitignore', '.github', 'LICENSE', 'README.md', 'VALIDATION.md', 'src', 'scripts', 'tests', 'assets']:
        path = root / name
        entries = [path] if path.is_file() else sorted(path.rglob('*'))
        for p in entries:
            if p.is_file() and '__pycache__' not in p.parts:
                z.write(p, Path('enhanced-23mofang') / p.relative_to(root))

with zipfile.ZipFile(installer) as z:
    assert z.testzip() is None
    manifest = json.loads(z.read('extension/manifest.json'))
    assert manifest['manifest_version'] == 3
    assert manifest['version'] == version
    assert 'extension/' + manifest['background']['service_worker'] in z.namelist()
    assert manifest['permissions'] == ['storage', 'unlimitedStorage']
    assert manifest['host_permissions'] == ['https://www.theytree.com/*', 'https://www.yfull.com/*', 'https://discover.familytreedna.com/*']
    assert 'extension/samples/background.js' in z.namelist()
    for script in manifest['content_scripts']:
        for name in script['js']:
            assert 'extension/' + name in z.namelist()
    for name in manifest['icons'].values():
        assert 'extension/' + name in z.namelist()
    atlas = json.loads(z.read('extension/assets/counties.geo.json'))
    assert atlas['metadata']['countyCount'] == len([f for f in atlas['features'] if f['properties']['level'] == 'district' and not f['properties'].get('group')])
    assert atlas['metadata']['historicalCount'] > 200
    assert not atlas['metadata']['failures']
    city_atlas = json.loads(z.read('extension/assets/cities.geo.json'))
    assert city_atlas['metadata']['cityCount'] == 367
    assert not city_atlas['metadata']['failures']
    assert not any(f['properties']['level'] == 'district' for f in city_atlas['features'])
    for p in (root / 'dist').rglob('*'):
        if p.is_file():
            assert z.read('extension/' + p.relative_to(root / 'dist').as_posix()) == p.read_bytes()
with zipfile.ZipFile(source) as z:
    assert z.testzip() is None

lines = []
for p in [installer, source]:
    digest = hashlib.sha256(p.read_bytes()).hexdigest()
    lines.append(f'{digest}  {p.name}')
    print(f'{p.name}: {p.stat().st_size:,} bytes; archive verified')
(release / 'SHA256SUMS.txt').write_text('\n'.join(lines) + '\n', encoding='utf-8')

readme = (root / 'README.md').read_text(encoding='utf-8')
section = re.search(r'^## ' + re.escape(version) + r'[^\n]*\n(.*?)(?=^## |\Z)', readme, re.M | re.S)
notes = '下载下方以 `-installer.zip` 结尾的安装包，解压后在 Edge / Chrome 扩展管理页开启开发者模式，选择“加载解压缩的扩展”，加载其中的 `extension` 文件夹。\n\n更新时覆盖原扩展目录，再重新加载扩展并刷新23魔方页面。无需自行编译；这不是浏览器商店自动更新包。\n\n附件提供安装包、源码包及 SHA256 校验文件。\n'
if section:
    notes += '\n## 本版更新\n\n' + section.group(1).strip() + '\n'
(release / 'RELEASE_NOTES.md').write_text(notes, encoding='utf-8')

from pathlib import Path
import json, shutil, zipfile, hashlib

root = Path(__file__).resolve().parents[1]
release = root / 'release'
release.mkdir(exist_ok=True)
bundle = release / '23mofang-county-map-v1.0.0'
bundle.mkdir(exist_ok=True)
shutil.copytree(root / 'dist', bundle / 'extension', dirs_exist_ok=True)
shutil.copy2(root / 'README.md', bundle / '安装与使用说明.md')
shutil.copy2(root / 'VALIDATION.md', bundle / '验证记录.md')

installer = release / '23魔方区县地图-v1.0.0-安装包.zip'
with zipfile.ZipFile(installer, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for p in sorted(bundle.rglob('*')):
        if p.is_file():
            z.write(p, p.relative_to(bundle))

source = release / '23魔方区县地图-v1.0.0-源码.zip'
with zipfile.ZipFile(source, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for name in ['package.json', 'package-lock.json', 'tsconfig.json', 'manifest.json', '.gitignore', 'README.md', 'VALIDATION.md', 'src', 'scripts', 'tests', 'assets', 'test-results']:
        path = root / name
        entries = [path] if path.is_file() else sorted(path.rglob('*'))
        for p in entries:
            if p.is_file() and '__pycache__' not in p.parts:
                z.write(p, Path('23mofang-county-map') / p.relative_to(root))

with zipfile.ZipFile(installer) as z:
    assert z.testzip() is None
    manifest = json.loads(z.read('extension/manifest.json'))
    assert manifest['manifest_version'] == 3
    for script in manifest['content_scripts']:
        for name in script['js']:
            assert 'extension/' + name in z.namelist()
    for name in manifest['icons'].values():
        assert 'extension/' + name in z.namelist()
    atlas = json.loads(z.read('extension/assets/counties.geo.json'))
    assert atlas['metadata']['countyCount'] == 2840
    assert not atlas['metadata']['failures']
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

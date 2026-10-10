import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
import zipfile


class ReleasePackageTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='mofang-package-test-')
        self.root = Path(self.temp.name).resolve()
        self.assertEqual(self.root.parent, Path(tempfile.gettempdir()).resolve())
        self.write('scripts/package.py', (Path(__file__).resolve().parents[1] / 'scripts/package.py').read_text(encoding='utf-8'))
        self.manifest = {
            'version': '1.5.30', 'manifest_version': 3,
            'permissions': ['storage', 'unlimitedStorage'],
            'host_permissions': ['https://www.theytree.com/*', 'https://www.yfull.com/*', 'https://discover.familytreedna.com/*'],
            'background': {'service_worker': 'worker.js'}, 'content_scripts': [{'js': ['content.js']}],
            'icons': {'48': 'icon.png'},
        }
        self.write('manifest.json', self.manifest)
        self.write('dist/manifest.json', self.manifest)
        self.write('package.json', {'version': '1.5.30'})
        self.write('package-lock.json', {'version': '1.5.30', 'packages': {'': {'version': '1.5.30'}}})
        for name in ['worker.js', 'content.js', 'icon.png', 'samples/background.js']:
            self.write('dist/' + name, 'test fixture')
        self.write('dist/assets/counties.geo.json', {'metadata': {'countyCount': 1, 'historicalCount': 201, 'failures': []}, 'features': [{'properties': {'level': 'district'}}]})
        self.write('dist/assets/cities.geo.json', {'metadata': {'cityCount': 367, 'failures': []}, 'features': []})
        for name in ['region-coverage', 'letter-node-audit', 'sample-sources', 'mofang-snp-exploration', 'yfull-letter-node-audit']:
            self.write('assets/' + name + '.md', 'fixture')
        self.write('README.md', '# Extension\n\n## 1.5.30：更新\n\n本版修改。\n\n## 1.5.29\n旧版。')
        self.write('VALIDATION.md', 'fixture validation')
        self.write('LICENSE', 'fixture license')
        self.write('.github/workflows/build-release.yml', 'name: fixture')
        self.write('test-results/local-only.txt', 'must not be distributed')

    def tearDown(self):
        self.assertEqual(self.root.parent, Path(tempfile.gettempdir()).resolve())
        self.temp.cleanup()

    def write(self, name, value):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(value) if isinstance(value, dict) else value, encoding='utf-8')

    def package(self, tag='v1.5.30'):
        return subprocess.run([sys.executable, str(self.root / 'scripts/package.py'), '--tag', tag], capture_output=True, text=True, encoding='utf-8')

    def test_release_archives_and_checksums(self):
        self.assertEqual(self.package().returncode, 0)
        release = self.root / 'release'
        for line in (release / 'SHA256SUMS.txt').read_text(encoding='utf-8').splitlines():
            digest, name = line.split('  ', 1)
            self.assertTrue(name.isascii(), 'GitHub strips non-ASCII attachment names')
            self.assertEqual(hashlib.sha256((release / name).read_bytes()).hexdigest(), digest)
        with zipfile.ZipFile(release / 'enhanced-23mofang-v1.5.30-source.zip') as archive:
            self.assertIn('enhanced-23mofang/.github/workflows/build-release.yml', archive.namelist())
            self.assertIn('enhanced-23mofang/LICENSE', archive.namelist())
            self.assertFalse(any('test-results' in name for name in archive.namelist()))
        notes = (release / 'RELEASE_NOTES.md').read_text(encoding='utf-8')
        self.assertIn('本版修改', notes)
        self.assertNotIn('旧版。', notes)

    def test_wrong_tag_stops_before_packaging(self):
        result = self.package('v1.5.31')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('does not match', result.stderr)
        self.assertFalse((self.root / 'release').exists())

    def test_stale_build_or_lock_stops_release(self):
        self.write('dist/manifest.json', {**self.manifest, 'version': '1.5.29'})
        self.assertNotEqual(self.package().returncode, 0)
        self.write('dist/manifest.json', self.manifest)
        self.write('package-lock.json', {'version': '1.5.29', 'packages': {'': {'version': '1.5.29'}}})
        self.assertNotEqual(self.package().returncode, 0)

    def test_stale_staging_file_is_not_in_installer(self):
        self.assertEqual(self.package().returncode, 0)
        self.write('release/enhanced-23mofang-v1.5.30/extension/stale.js', 'old payload')
        self.assertEqual(self.package().returncode, 0)
        with zipfile.ZipFile(self.root / 'release/enhanced-23mofang-v1.5.30-installer.zip') as archive:
            self.assertNotIn('extension/stale.js', archive.namelist())
            self.assertIn('LICENSE', archive.namelist())


if __name__ == '__main__':
    unittest.main()

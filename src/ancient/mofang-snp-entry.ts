import {bootSnpPage} from './snp-page';
if (document.body) bootSnpPage();
else document.addEventListener('DOMContentLoaded', () => bootSnpPage(), {once: true});

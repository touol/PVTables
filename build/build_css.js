import libraries from './libraries.js'
import fs from 'fs';

// import { resolve, dirname } from 'path'
// import { fileURLToPath } from 'url';

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = dirname(__filename);


let css = ''
for(let key in libraries){
    if(libraries[key].css) css = css + fs.readFileSync(libraries[key].css, 'utf8');
}
fs.writeFileSync('./dist/pvtables/style.css', css);
console.log('Save css');



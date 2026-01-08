import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import removeExternalDuplicates from './postcss-remove-external-duplicates.js';

export default {
  plugins: [
    tailwindcss(),
    autoprefixer()
  ],
}

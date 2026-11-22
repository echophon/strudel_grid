// The example series in /examples, bundled as text. Each file is a complete project;
// the number prefix orders them from a single row up to the full set.
const files = import.meta.glob<string>('../examples/*.js', { query: '?raw', import: 'default', eager: true });

export interface Example {
  /** file name, e.g. '03-lengths.js' */
  file: string;
  /** menu label, e.g. '03 lengths' */
  title: string;
  code: string;
}

export const EXAMPLES: Example[] = Object.entries(files)
  .map(([path, code]) => {
    const file = path.split('/').pop()!;
    return { file, title: file.replace(/\.js$/, '').replace(/^(\d+)-/, '$1 ').replace(/-/g, ' '), code };
  })
  .sort((a, b) => a.file.localeCompare(b.file));

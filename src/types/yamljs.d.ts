declare module 'yamljs' {
  interface YamlObject {
    [key: string]: any;
  }

  function load(path: string): YamlObject;
  function parse(yamlString: string): YamlObject;
  function stringify(obj: any, indent?: number): string;
}

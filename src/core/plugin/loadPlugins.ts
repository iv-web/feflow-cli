import fs from 'fs';
import osenv from 'osenv';
import path from 'path';
import applyPlugins from './applyPlugins';

export default function loadPlugins(ctx: FeflowInterface): Promise<void> {

  const { root, rootPkg } = ctx;

  return new Promise<void>((resolve, reject) => {
    fs.readFile(rootPkg, 'utf8', (err, data) => {
      if (err) {
        reject(err);
      } else {
        const json : Package = JSON.parse(data);
        const deps = json.dependencies || json.devDependencies || {};
        const plugins = Object.keys(deps).filter((name) => {
          if (!/^feflow-plugin-|^@[^/]+\/feflow-plugin-/.test(name)) {
            return false;
          }
          const pluginPath = path.join(root, 'node_modules', name);
          return fs.existsSync(pluginPath);
        });
        applyPlugins(plugins)(ctx);
        resolve();
      }
    });
  });
}
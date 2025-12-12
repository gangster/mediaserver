const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');
const fs = require('fs');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch all files in the monorepo
config.watchFolders = [monorepoRoot];

// Let Metro know where to resolve packages from
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Add .ts and .tsx to source extensions
config.resolver.sourceExts = ['ts', 'tsx', 'js', 'jsx', 'json', 'cjs', 'mjs'];

// Enable unstable_enablePackageExports to properly resolve ESM exports
config.resolver.unstable_enablePackageExports = true;

// Resolve workspace packages from source
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Force zustand to use CommonJS versions to avoid import.meta issues
  // zustand's ESM files use import.meta.env which doesn't work in Metro for web
  if (moduleName === 'zustand') {
    return {
      filePath: path.resolve(projectRoot, 'node_modules/zustand/index.js'),
      type: 'sourceFile',
    };
  }
  if (moduleName === 'zustand/vanilla') {
    return {
      filePath: path.resolve(projectRoot, 'node_modules/zustand/vanilla.js'),
      type: 'sourceFile',
    };
  }
  if (moduleName === 'zustand/middleware') {
    return {
      filePath: path.resolve(projectRoot, 'node_modules/zustand/middleware.js'),
      type: 'sourceFile',
    };
  }
  if (moduleName === 'zustand/shallow') {
    return {
      filePath: path.resolve(projectRoot, 'node_modules/zustand/shallow.js'),
      type: 'sourceFile',
    };
  }

  // Check if it's one of our workspace packages
  if (moduleName.startsWith('@mediaserver/')) {
    const packageName = moduleName.replace('@mediaserver/', '');
    const sourcePath = path.resolve(monorepoRoot, `packages/${packageName}/src/index.ts`);
    
    try {
      if (fs.existsSync(sourcePath)) {
        return {
          filePath: sourcePath,
          type: 'sourceFile',
        };
      }
    } catch {
      // Fall through to default resolution
    }
  }
  
  // Handle .js extension imports resolving to .ts files within monorepo packages
  if (moduleName.startsWith('./') || moduleName.startsWith('../')) {
    const originDir = path.dirname(context.originModulePath);
    
    // Check if we're in a monorepo package source directory
    if (originDir.includes('/packages/') && originDir.includes('/src')) {
      // Try resolving .js to .ts
      if (moduleName.endsWith('.js')) {
        const tsPath = path.resolve(originDir, moduleName.replace(/\.js$/, '.ts'));
        const tsxPath = path.resolve(originDir, moduleName.replace(/\.js$/, '.tsx'));
        
        if (fs.existsSync(tsPath)) {
          return {
            filePath: tsPath,
            type: 'sourceFile',
          };
        }
        if (fs.existsSync(tsxPath)) {
          return {
            filePath: tsxPath,
            type: 'sourceFile',
          };
        }
      }
    }
  }
  
  // Use default resolution
  return context.resolveRequest(context, moduleName, platform);
};

// Force Metro to resolve certain packages from the app's node_modules
config.resolver.disableHierarchicalLookup = true;

module.exports = withNativeWind(config, { input: './global.css' });

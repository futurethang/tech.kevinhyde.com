// Phase 0 verification helper: load + validate config/sources.yaml and print it.
// Usage:
//   pnpm check:config                  # validates ./config/sources.yaml
//   pnpm check:config path/to/file.yaml
import { loadSourcesConfig, SourcesConfigError } from '@marginalia/core/sources-config';

const path = process.argv[2];

try {
  const config = loadSourcesConfig(path);
  console.log('✓ sources config is valid\n');
  console.log(JSON.stringify(config, null, 2));
} catch (err) {
  if (err instanceof SourcesConfigError) {
    console.error(`✗ ${err.message}`);
    process.exit(1);
  }
  throw err;
}

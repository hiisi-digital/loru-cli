export interface MetaConfig {
  schema_version?: string;
}

export interface PluginEntry {
  id?: string;
  name?: string;
  path?: string;
  entrypoint?: string;
  schema_version?: string;
  version?: string;
}

export interface PageEntry {
  id?: string;
  name?: string;
  path?: string;
  entrypoint?: string;
  schema_version?: string;
  domains?: string[];
  locales?: string[];
}

export interface LoruConfig {
  meta?: MetaConfig;
  plugin?: PluginEntry[];
  page?: PageEntry[];
}

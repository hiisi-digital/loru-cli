import { fetchBom } from "https://raw.githubusercontent.com/hiisi-digital/loru-devkit/v0.2.0/deno/mod.ts";

export async function bomHandler(_flags: Record<string, unknown>) {
  const path = await fetchBom({});
  console.log(path);
}

import { fetchBom } from "https://raw.githubusercontent.com/hiisi-digital/loru-devkit/main/deno/mod.ts";

export async function bomHandler(_flags: Record<string, unknown>) {
  const path = await fetchBom({});
  console.log(path);
}

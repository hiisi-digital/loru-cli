import { fetchBom } from "@loru/devkit";

export async function bomHandler(_flags: Record<string, unknown>) {
  const path = await fetchBom({});
  console.log(path);
}

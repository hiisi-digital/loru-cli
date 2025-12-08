import { fetchBom } from "../../devkit.ts";

export async function bomHandler(_flags: Record<string, unknown>) {
  const path = await fetchBom({});
  console.log(path);
}

import { describe, expect, it } from "vitest";
import { buildSceneModel } from "@/lib/buildSceneModel";
import { FIXTURES } from "../fixtures/configs";

describe("scene golden", () => {
  for (const f of FIXTURES) {
    it(f.id, () => {
      expect(buildSceneModel(f.config)).toMatchSnapshot();
    });
  }
});

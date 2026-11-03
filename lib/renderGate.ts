/** Whether each part (backdrop, kids' table, welcome board, giveaways) must be rendered before it can be finalized.
 *  Off for now (2026-11-03, the owner: "şimdilik generate render'a zorlamayı kapayalım, release ederken koyarız"):
 *  the renders stay offered, nothing waits for them. Set NEXT_PUBLIC_REQUIRE_RENDER=1 on Vercel at release. */
export const REQUIRE_RENDER = process.env.NEXT_PUBLIC_REQUIRE_RENDER === "1";

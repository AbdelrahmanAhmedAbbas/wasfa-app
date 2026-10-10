/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";

import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

test("signed-in members can post and toggle one vote each", async () => {
  const t = convexTest(schema, modules);
  const [authorId, voterId] = await t.run(async (ctx) => [
    await ctx.db.insert("users", { email: "author@example.com" }),
    await ctx.db.insert("users", { email: "voter@example.com" }),
  ]);
  const author = t.withIdentity({ subject: authorId });
  const voter = t.withIdentity({ subject: voterId });

  await expect(t.mutation(api.feedback.submit, {
    kind: "bug", title: "Broken import", detail: "The Instagram link did not import.",
  })).rejects.toThrow();

  const postId = await author.mutation(api.feedback.submit, {
    kind: "bug", title: "Broken import", detail: "The Instagram link did not import.",
  });
  expect((await author.query(api.feedback.list))[0]).toMatchObject({
    id: postId, title: "Broken import", voteCount: 0, voted: false,
  });

  expect(await voter.mutation(api.feedback.toggleVote, { postId })).toBe(true);
  expect((await voter.query(api.feedback.list))[0]).toMatchObject({ voteCount: 1, voted: true });
  expect((await author.query(api.feedback.list))[0]).toMatchObject({ voteCount: 1, voted: false });

  expect(await voter.mutation(api.feedback.toggleVote, { postId })).toBe(false);
  expect((await voter.query(api.feedback.list))[0]).toMatchObject({ voteCount: 0, voted: false });
});

test("one account cannot flood the public board", async () => {
  const t = convexTest(schema, modules);
  const userId = await t.run((ctx) => ctx.db.insert("users", { email: "writer@example.com" }));
  const writer = t.withIdentity({ subject: userId });
  for (let index = 0; index < 3; index += 1) {
    await writer.mutation(api.feedback.submit, {
      kind: "feature", title: `Idea ${index}`, detail: "A useful feature request",
    });
  }
  await expect(writer.mutation(api.feedback.submit, {
    kind: "feature", title: "Idea 4", detail: "One more feature request",
  })).rejects.toThrow("three posts");
});

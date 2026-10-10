import test from "node:test";
import assert from "node:assert/strict";

import { welcomeEmail } from "./welcomeEmail.ts";

test("welcome email uses the verified sender and escapes the recipient's name", () => {
  const email = welcomeEmail(
    { email: " Person@Example.com ", name: '<Ava & Friends> Smith' },
    "Wasfa <hello@wasfa.life>",
  );

  assert.equal(email.from, "Wasfa <hello@wasfa.life>");
  assert.deepEqual(email.to, ["person@example.com"]);
  assert.match(email.html, /Hi &lt;Ava,/);
  assert.doesNotMatch(email.html, /Hi <Ava/);
  assert.match(email.text, /أهلاً بك في وصفة/);
  assert.match(email.html, /https:\/\/www\.wasfa\.life\/brand\/logo-1\.png/);
  assert.match(email.html, /alt="Wasfa"/);
  assert.match(email.html, /#5A8A5A|#3D6B3D/);
  assert.match(email.html, /#FFFCF6/);
  assert.match(email.html, /#F2851A/);
});

test("welcome email works without a name", () => {
  const email = welcomeEmail({ email: "person@example.com", name: null }, "hello@wasfa.life");
  assert.match(email.text, /^Hi,/);
});

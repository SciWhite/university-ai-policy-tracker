import React from "react";
import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { PolicyBidiText } from "../apps/web/components/policy-bidi-text";

const visible = (html: string) => html.replace(/<[^>]+>/g, "").replaceAll("&amp;", "&").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", '"').replaceAll("&#x27;", "'");

test("mixed RTL identifiers keep the complete original text", () => {
  const text = "راجع {sourceCount} مصادر: https://eduaipolicy.org/universities/korea-university#coursework، Claim ID cc-ku-010 و ChatGPT Edu — 2026-10-28.";
  const html = renderToStaticMarkup(<PolicyBidiText text={text} />);
  assert.equal(visible(html), text);
  assert.match(html, /<bdi[^>]*dir="ltr"[^>]*>cc-ku-010<\/bdi>/);
  assert.match(html, /#coursework<\/bdi>،/);
});

test("original-language quotations and literal markup are not rewritten or executed", () => {
  const text = "学生は条件を守る。 <script>alert('x')</script> & T0";
  const html = renderToStaticMarkup(<PolicyBidiText text={text} />);
  assert.equal(visible(html), text);
  assert.ok(!html.includes("<script>"));
  assert.match(html, /dir="auto"/);
});

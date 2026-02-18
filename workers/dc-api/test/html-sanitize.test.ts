import { describe, it, expect } from "vitest";
import { sanitizeGoogleDocsHtml } from "../src/utils/html-sanitize.js";

/**
 * HTML sanitization tests.
 *
 * Tests the Google Docs HTML cleanup utility that converts verbose
 * exported HTML into a Tiptap-compatible subset.
 */
describe("sanitizeGoogleDocsHtml", () => {
  it("extracts body content from full document", () => {
    const input =
      "<html><head><style>.c1{font-weight:bold}</style></head><body><p>Hello world</p></body></html>";
    const result = sanitizeGoogleDocsHtml(input);
    expect(result).toBe("<p>Hello world</p>");
  });

  it("preserves allowed tags", () => {
    const input = "<h1>Title</h1><p>Text with <strong>bold</strong> and <em>italic</em>.</p>";
    const result = sanitizeGoogleDocsHtml(input);
    expect(result).toContain("<h1>Title</h1>");
    expect(result).toContain("<strong>bold</strong>");
    expect(result).toContain("<em>italic</em>");
  });

  it("preserves lists", () => {
    const input = "<ul><li>Item 1</li><li>Item 2</li></ul><ol><li>One</li></ol>";
    const result = sanitizeGoogleDocsHtml(input);
    expect(result).toContain("<ul>");
    expect(result).toContain("<li>Item 1</li>");
    expect(result).toContain("<ol>");
  });

  it("preserves blockquotes", () => {
    const input = "<blockquote>A wise quote</blockquote>";
    const result = sanitizeGoogleDocsHtml(input);
    expect(result).toContain("<blockquote>A wise quote</blockquote>");
  });

  it("preserves links with href only", () => {
    const input = '<a href="https://example.com" class="c1" target="_blank">Link</a>';
    const result = sanitizeGoogleDocsHtml(input);
    expect(result).toContain('<a href="https://example.com">Link</a>');
    expect(result).not.toContain("class=");
    expect(result).not.toContain("target=");
  });

  it("converts <b> to <strong> and <i> to <em>", () => {
    const input = "<p><b>bold</b> and <i>italic</i></p>";
    const result = sanitizeGoogleDocsHtml(input);
    expect(result).toContain("<strong>bold</strong>");
    expect(result).toContain("<em>italic</em>");
  });

  it("strips inline styles", () => {
    const input = '<p style="color: red; font-family: Arial; margin-top: 12pt;">Styled text</p>';
    const result = sanitizeGoogleDocsHtml(input);
    expect(result).toBe("<p>Styled text</p>");
  });

  it("strips class attributes", () => {
    const input = '<p class="c1 c2">Text with classes</p>';
    const result = sanitizeGoogleDocsHtml(input);
    expect(result).toBe("<p>Text with classes</p>");
  });

  it("strips style blocks", () => {
    const input = "<style>.c1{font-weight:bold}</style><p>After style</p>";
    const result = sanitizeGoogleDocsHtml(input);
    expect(result).toBe("<p>After style</p>");
  });

  it("unwraps span elements keeping text", () => {
    const input = '<p><span class="c1" style="font-weight:700">Important</span> text</p>';
    const result = sanitizeGoogleDocsHtml(input);
    expect(result).toContain("Important text");
    expect(result).not.toContain("<span");
  });

  it("unwraps div elements keeping text", () => {
    const input = '<div class="doc-content"><p>Inside a div</p></div>';
    const result = sanitizeGoogleDocsHtml(input);
    expect(result).toContain("<p>Inside a div</p>");
    expect(result).not.toContain("<div");
  });

  it("strips table elements", () => {
    const input = "<table><tr><td>Cell content</td></tr></table><p>After table</p>";
    const result = sanitizeGoogleDocsHtml(input);
    expect(result).toContain("Cell content");
    expect(result).not.toContain("<table");
    expect(result).not.toContain("<tr");
    expect(result).not.toContain("<td");
  });

  it("strips img elements", () => {
    const input = '<p>Before<img src="https://example.com/img.png" />After</p>';
    const result = sanitizeGoogleDocsHtml(input);
    expect(result).not.toContain("<img");
    expect(result).toContain("BeforeAfter");
  });

  it("removes empty paragraphs", () => {
    const input = "<p>Content</p><p></p><p> </p><p><br></p><p>&nbsp;</p><p>More content</p>";
    const result = sanitizeGoogleDocsHtml(input);
    expect(result).toContain("<p>Content</p>");
    expect(result).toContain("<p>More content</p>");
    // Empty paragraphs should be gone
    expect(result).not.toMatch(/<p>(\s|&nbsp;|<br\s*\/?>)*<\/p>/);
  });

  it("strips script tags", () => {
    const input = "<p>Safe</p><script>alert('xss')</script><p>Also safe</p>";
    const result = sanitizeGoogleDocsHtml(input);
    expect(result).not.toContain("<script");
    expect(result).not.toContain("alert");
    expect(result).toContain("<p>Safe</p>");
  });

  it("strips iframe tags", () => {
    const input = '<iframe src="https://evil.com"></iframe><p>Content</p>';
    const result = sanitizeGoogleDocsHtml(input);
    expect(result).not.toContain("<iframe");
    expect(result).toContain("<p>Content</p>");
  });

  it("strips event handler attributes", () => {
    const input = '<p onclick="alert(1)" onmouseover="hack()">Text</p>';
    const result = sanitizeGoogleDocsHtml(input);
    expect(result).not.toContain("onclick");
    expect(result).not.toContain("onmouseover");
    expect(result).toBe("<p>Text</p>");
  });

  it("strips javascript: URLs in links", () => {
    const input = '<a href="javascript:alert(1)">Click me</a>';
    const result = sanitizeGoogleDocsHtml(input);
    expect(result).not.toContain("javascript:");
  });

  it("handles realistic Google Docs export", () => {
    const input = `<html><head><meta content="text/html; charset=UTF-8" http-equiv="content-type">
<style type="text/css">.c0{font-weight:700;font-style:italic}.c1{color:#000000;font-weight:400}</style>
</head><body class="doc-content">
<h1 class="c3"><span class="c0">Chapter 1: Introduction</span></h1>
<p class="c2"><span class="c1">This is the </span><span class="c0">opening paragraph</span><span class="c1"> of my book. It discusses </span><span class="c1">important topics.</span></p>
<p class="c2"><span class="c1"></span></p>
<ul class="c4"><li class="c5"><span class="c1">First point</span></li><li class="c5"><span class="c1">Second point</span></li></ul>
<p class="c2"><span class="c1">&nbsp;</span></p>
<blockquote class="c6"><span class="c1">A relevant quote from a source.</span></blockquote>
</body></html>`;

    const result = sanitizeGoogleDocsHtml(input);

    expect(result).toContain("<h1>Chapter 1: Introduction</h1>");
    expect(result).toContain("opening paragraph");
    expect(result).toContain("<li>First point</li>");
    expect(result).toContain("<blockquote>A relevant quote from a source.</blockquote>");
    expect(result).not.toContain("class=");
    expect(result).not.toContain("<style");
    expect(result).not.toContain("<span");
  });

  it("handles empty input", () => {
    expect(sanitizeGoogleDocsHtml("")).toBe("");
  });

  it("handles plain text without tags", () => {
    const result = sanitizeGoogleDocsHtml("Just plain text");
    expect(result).toBe("Just plain text");
  });

  it("preserves heading levels", () => {
    const input = "<h1>H1</h1><h2>H2</h2><h3>H3</h3><h4>H4</h4><h5>H5</h5><h6>H6</h6>";
    const result = sanitizeGoogleDocsHtml(input);
    expect(result).toContain("<h1>H1</h1>");
    expect(result).toContain("<h2>H2</h2>");
    expect(result).toContain("<h3>H3</h3>");
    expect(result).toContain("<h4>H4</h4>");
    expect(result).toContain("<h5>H5</h5>");
    expect(result).toContain("<h6>H6</h6>");
  });
});

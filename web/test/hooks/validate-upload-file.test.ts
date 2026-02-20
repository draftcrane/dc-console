import { describe, it, expect } from "vitest";
import { validateUploadFile } from "@/hooks/use-sources";

/** Helper to create a minimal File-like object for testing. */
function makeFile(name: string, size: number): File {
  const content = new Uint8Array(size);
  return new File([content], name);
}

describe("validateUploadFile", () => {
  it("accepts .txt files within size limit", () => {
    expect(validateUploadFile(makeFile("notes.txt", 1024))).toBeNull();
  });

  it("accepts .md files within size limit", () => {
    expect(validateUploadFile(makeFile("README.md", 2048))).toBeNull();
  });

  it("accepts .docx files within size limit", () => {
    expect(validateUploadFile(makeFile("paper.docx", 1024))).toBeNull();
  });

  it("accepts .pdf files within size limit", () => {
    expect(validateUploadFile(makeFile("report.pdf", 1024))).toBeNull();
  });

  it("accepts uppercase extensions like .PDF", () => {
    expect(validateUploadFile(makeFile("report.PDF", 1024))).toBeNull();
  });

  it("rejects unsupported extension .exe", () => {
    const result = validateUploadFile(makeFile("malware.exe", 100));
    expect(result).toContain("Unsupported file format");
  });

  it("rejects unsupported extension .zip", () => {
    const result = validateUploadFile(makeFile("archive.zip", 100));
    expect(result).toContain("Unsupported file format");
  });

  it("rejects a file with no extension", () => {
    const result = validateUploadFile(makeFile("noext", 100));
    expect(result).toContain("Unsupported file format");
  });

  it("rejects a text file exceeding 5MB", () => {
    const overLimit = 5 * 1024 * 1024 + 1;
    const result = validateUploadFile(makeFile("big.txt", overLimit));
    expect(result).toContain("File too large");
    expect(result).toContain("5MB");
  });

  it("rejects an .md file exceeding 5MB", () => {
    const overLimit = 5 * 1024 * 1024 + 1;
    const result = validateUploadFile(makeFile("big.md", overLimit));
    expect(result).toContain("File too large");
  });

  it("rejects a binary file (.pdf) exceeding 20MB", () => {
    const overLimit = 20 * 1024 * 1024 + 1;
    const result = validateUploadFile(makeFile("huge.pdf", overLimit));
    expect(result).toContain("File too large");
    expect(result).toContain("20MB");
  });

  it("rejects a binary file (.docx) exceeding 20MB", () => {
    const overLimit = 20 * 1024 * 1024 + 1;
    const result = validateUploadFile(makeFile("huge.docx", overLimit));
    expect(result).toContain("File too large");
  });

  it("accepts a text file exactly at 5MB", () => {
    const exactLimit = 5 * 1024 * 1024;
    expect(validateUploadFile(makeFile("exact.txt", exactLimit))).toBeNull();
  });

  it("accepts a binary file exactly at 20MB", () => {
    const exactLimit = 20 * 1024 * 1024;
    expect(validateUploadFile(makeFile("exact.pdf", exactLimit))).toBeNull();
  });
});

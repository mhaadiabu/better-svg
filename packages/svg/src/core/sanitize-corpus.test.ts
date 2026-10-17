import { describe, expect, it } from "vitest";
import { parseInlineSvg } from "./sanitize";

describe("hostile corpus: script execution", () => {
  const cases: { markup: string; expected: string }[] = [
    { markup: "<svg><script>alert(1)</script><rect/></svg>", expected: "<rect/>" },
    { markup: "<svg><ScRiPt>alert(1)</ScRiPt><rect/></svg>", expected: "<rect/>" },
    {
      markup: "<svg><script src='https://evil.com/x.js'/><rect/></svg>",
      expected: "<rect/>",
    },
    {
      markup: "<svg><g><script>alert(1)</script></g><rect/></svg>",
      expected: "<g/><rect/>",
    },
    {
      markup: "<svg><defs><script>alert(1)</script></defs><rect/></svg>",
      expected: "<defs/><rect/>",
    },
    {
      markup: "<svg><noscript><script>alert(1)</script></noscript><rect/></svg>",
      expected: "<rect/>",
    },
  ];
  it.each(cases)("neutralizes $markup", ({ markup, expected }) => {
    const result = parseInlineSvg(markup, true);
    expect(result).not.toBeNull();
    expect(result!.innerHTML).toBe(expected);
  });

  it("leaves no executable content behind when a script carries CDATA", () => {
    const markup = "<svg><script><![CDATA[alert(1)]]></script><rect/></svg>";
    const result = parseInlineSvg(markup, true);
    expect(result?.innerHTML ?? "").not.toContain("<script");
  });
});

describe("hostile corpus: event handler attributes", () => {
  const cases: { markup: string; expected: string }[] = [
    {
      markup: "<svg><rect onload='alert(1)' fill='red'/></svg>",
      expected: '<rect fill="red"/>',
    },
    {
      markup: "<svg><rect ONCLICK='alert(1)' fill='red'/></svg>",
      expected: '<rect fill="red"/>',
    },
    {
      markup: "<svg><rect oNeRrOr='alert(1)' fill='red'/></svg>",
      expected: '<rect fill="red"/>',
    },
    {
      markup: "<svg><a onload='alert(1)' href='#anchor'><rect/></a></svg>",
      expected: '<a href="#anchor"><rect/></a>',
    },
    {
      markup: "<svg><image onload='alert(1)' href='#icon'/></svg>",
      expected: '<image href="#icon"/>',
    },
    { markup: "<svg onload='alert(1)'><rect/></svg>", expected: "<rect/>" },
    {
      markup: "<svg><rect onbeforescriptexecute='alert(1)' fill='red'/></svg>",
      expected: '<rect fill="red"/>',
    },
  ];
  it.each(cases)("strips handlers from $markup", ({ markup, expected }) => {
    const result = parseInlineSvg(markup, true);
    expect(result).not.toBeNull();
    expect(result!.innerHTML).toBe(expected);
  });

  it("strips namespaced event-handler attributes like xlink:onclick", () => {
    const result = parseInlineSvg(
      "<svg xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' xmlns:evil='http://evil.example/'><rect xlink:onclick='alert(1)' evil:onclick='alert(2)' fill='red'/></svg>",
      true,
    );
    expect(result).not.toBeNull();
    expect(result!.innerHTML).toBe('<rect fill="red"/>');
  });
});

describe("hostile corpus: foreignObject smuggling", () => {
  const cases: { markup: string; expected: string }[] = [
    {
      markup:
        "<svg><foreignObject><body><div onerror='alert(1)'>payload</div></body></foreignObject><rect/></svg>",
      expected: "<rect/>",
    },
    {
      markup: "<svg><FOREIGNOBJECT><img onerror='alert(1)'></img></FOREIGNOBJECT><rect/></svg>",
      expected: "<rect/>",
    },
    {
      markup:
        "<svg><foreignObject xmlns='http://www.w3.org/1999/xhtml'><iframe onerror='alert(1)'></iframe></foreignObject><rect/></svg>",
      expected: "<rect/>",
    },
    {
      markup: "<svg><defs><foreignObject><body>x</body></foreignObject></defs><rect/></svg>",
      expected: "<defs/><rect/>",
    },
  ];
  it.each(cases)("strips $markup", ({ markup, expected }) => {
    const result = parseInlineSvg(markup, true);
    expect(result).not.toBeNull();
    expect(result!.innerHTML).toBe(expected);
  });
});

describe("hostile corpus: href protocol filtering", () => {
  const cases: { markup: string; expected: string }[] = [
    { markup: "<svg><use href='javascript:alert(1)'/><rect/></svg>", expected: "<use/><rect/>" },
    {
      markup: "<svg><use xlink:href='java&#x09;script:alert(1)'/><rect/></svg>",
      expected: "<use/><rect/>",
    },
    {
      markup: "<svg><a href='javas&#99;ript:alert(1)'><rect/></a></svg>",
      expected: "<a><rect/></a>",
    },
    {
      markup: "<svg><a href='&#14;javascript:alert(1)'><rect/></a></svg>",
      expected: "<a><rect/></a>",
    },
    {
      markup: "<svg><a href='vbscript:msgbox(1)'><rect/></a></svg>",
      expected: "<a><rect/></a>",
    },
    {
      markup: "<svg><image href='javascript:alert(1)'/></svg>",
      expected: "<image/>",
    },
    {
      markup: "<svg><feImage href='javascript:alert(1)'/></svg>",
      expected: "<feImage/>",
    },
    {
      markup:
        "<svg><a href='data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=='><rect/></a></svg>",
      expected: "<a><rect/></a>",
    },
    {
      markup: "<svg><use XLINK:HREF='javascript:alert(1)'/><rect/></svg>",
      expected: "<use/><rect/>",
    },
    {
      markup: "<svg><rect HREF='javascript:alert(1)'/></svg>",
      expected: "<rect/>",
    },
    {
      markup: "<svg><use href='DATA:TEXT/HTML;base64,x'/><rect/></svg>",
      expected: "<use/><rect/>",
    },
  ];
  it.each(cases)("neutralizes $markup", ({ markup, expected }) => {
    const result = parseInlineSvg(markup, true);
    expect(result).not.toBeNull();
    expect(result!.innerHTML).toBe(expected);
  });

  it(
    "strips data:image/svg+xml references from use href and xlink:href, including case-obfuscated schemes",
    () => {
      const result = parseInlineSvg(
        "<svg><use href='data:image/svg+xml;base64,PHN2Zy8+'/><use href='DATA:IMAGE/SVG+XML,_'/><rect/></svg>",
        true,
      );
      expect(result).not.toBeNull();
      expect(result!.innerHTML).toBe("<use/><use/><rect/>");
    },
  );
  it("strips data:image/svg+xml references from a href", () => {
    const result = parseInlineSvg(
      "<svg><a href='data:image/svg+xml;base64,PHN2Zy8+'><rect/></a></svg>",
      true,
    );
    expect(result).not.toBeNull();
    expect(result!.innerHTML).toBe("<a><rect/></a>");
  });
  it("strips data:image/svg+xml references from image href", () => {
    const result = parseInlineSvg(
      "<svg><image href='data:image/svg+xml;base64,PHN2Zy8+'/></svg>",
      true,
    );
    expect(result).not.toBeNull();
    expect(result!.innerHTML).toBe("<image/>");
  });
  it("strips data:image/svg+xml references from feImage href", () => {
    const result = parseInlineSvg(
      "<svg><feImage href='data:image/svg+xml;base64,PHN2Zy8+'/></svg>",
      true,
    );
    expect(result).not.toBeNull();
    expect(result!.innerHTML).toBe("<feImage/>");
  });
  it("strips external document references from use href, including https and protocol-relative forms", () => {
    const result = parseInlineSvg(
      "<svg><use href='https://evil.com/icon.svg'/><use href='//evil.com/icon.svg'/><rect/></svg>",
      true,
    );
    expect(result).not.toBeNull();
    expect(result!.innerHTML).toBe("<use/><use/><rect/>");
  });
});

describe("hostile corpus: css injection and exfiltration", () => {
  const cases: { markup: string; expected: string }[] = [
    {
      markup: "<svg><style>@import 'https://evil.com/x.css'; rect{fill:red}</style><rect/></svg>",
      expected: "<rect/>",
    },
    {
      markup:
        "<svg><rect style='fill: red; background: url(javascript:alert(1))' fill='red'/></svg>",
      expected: '<rect fill="red"/>',
    },
    {
      markup: "<svg><rect style='fill:url(&#106;avascript:alert(1))' fill='red'/></svg>",
      expected: '<rect fill="red"/>',
    },
    {
      markup: "<svg><text>'><script>alert(1)</script></text><rect/></svg>",
      expected: "<text>'&gt;</text><rect/>",
    },
  ];
  it.each(cases)("neutralizes $markup", ({ markup, expected }) => {
    const result = parseInlineSvg(markup, true);
    expect(result).not.toBeNull();
    expect(result!.innerHTML).toBe(expected);
  });

  it("strips remote url() targets from the root style attribute", () => {
    const result = parseInlineSvg(
      "<svg style='fill:url(https://evil.com/x.css)'><rect/></svg>",
      true,
    );
    expect(result).not.toBeNull();
    expect(result!.style).toBeUndefined();
    expect(result!.innerHTML).toBe("<rect/>");
  });
  it("strips remote url() targets from element style attributes", () => {
    const result = parseInlineSvg(
      "<svg><rect style='fill:url(https://evil.com/x.css)' fill='red'/></svg>",
      true,
    );
    expect(result).not.toBeNull();
    expect(result!.innerHTML).toBe('<rect fill="red"/>');
  });
  it("normalizes whitespace between function name and parenthesis when checking style url()", () => {
    const result = parseInlineSvg(
      "<svg><rect style='fill:url (javascript:alert(1))' fill='red'/></svg>",
      true,
    );
    expect(result).not.toBeNull();
    expect(result!.innerHTML).toBe('<rect fill="red"/>');
  });
});

describe("hostile corpus: namespace trickery", () => {
  const safeCases: { markup: string; expected: string }[] = [
    {
      markup:
        "<svg xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink'><use xlink:href='javascript:alert(1)'/><rect/></svg>",
      expected: "<use/><rect/>",
    },
    {
      markup: "<svg><rect HREF='javascript:alert(1)' xlink:title='ok'/></svg>",
      expected: '<rect xlink:title="ok"/>',
    },
  ];
  it.each(safeCases)("filters hostile attributes in $markup", ({ markup, expected }) => {
    const result = parseInlineSvg(markup, true);
    expect(result).not.toBeNull();
    expect(result!.innerHTML).toBe(expected);
  });

  it("rejects unknown-namespace elements", () => {
    const result = parseInlineSvg("<svg><evil:tag/><rect/></svg>", true);
    expect(result).toBeNull();
  });

  it("rejects prefixed script elements", () => {
    const result = parseInlineSvg("<svg><svg:script>alert(1)</svg:script></svg>", true);
    expect(result).toBeNull();
  });

  it(
    "resolves re-prefixed attributes before protocol checks, such as evil:href bound to the xlink namespace",
    () => {
      const result = parseInlineSvg(
        "<svg xmlns='http://www.w3.org/2000/svg' xmlns:evil='http://www.w3.org/1999/xlink'><use evil:href='javascript:alert(1)'/><rect/></svg>",
        true,
      );
      expect(result).not.toBeNull();
      expect(result!.innerHTML).toBe("<use/><rect/>");
    },
  );
});

describe("hostile corpus: entity and doctype tricks", () => {
  it("rejects markup referencing an undeclared single entity", () => {
    const markup = "<!DOCTYPE svg [<!ENTITY x 'javascript:alert(1)'>]><svg><a href='&x;'/></svg>";
    expect(parseInlineSvg(markup, true)).toBeNull();
  });

  it("rejects markup referencing nested entities", () => {
    const markup =
      "<!DOCTYPE svg [<!ENTITY y '&x;'><!ENTITY x 'javascript:alert(1)'>]><svg><a href='&y;'/></svg>";
    expect(parseInlineSvg(markup, true)).toBeNull();
  });

  it("rejects markup referencing an external entity", () => {
    const markup =
      "<!DOCTYPE svg [<!ENTITY x SYSTEM 'https://evil.com/x.txt'>]><svg><a href='&x;'/></svg>";
    expect(parseInlineSvg(markup, true)).toBeNull();
  });

  it("does not carry external DTD references into the output", () => {
    const result = parseInlineSvg(
      "<!DOCTYPE svg SYSTEM 'https://evil.com/evil.dtd'><svg><rect/></svg>",
      true,
    );
    expect(result).not.toBeNull();
    expect(result!.innerHTML).toBe("<rect/>");
  });

  it("keeps entity-decoded script text escaped on re-serialization", () => {
    const result = parseInlineSvg(
      "<svg><text>&lt;script&gt;alert(1)&lt;/script&gt;</text></svg>",
      true,
    );
    expect(result).not.toBeNull();
    expect(result!.innerHTML).toBe("<text>&lt;script&gt;alert(1)&lt;/script&gt;</text>");
  });

  it("neutralizes double-encoded script payloads in text", () => {
    const result = parseInlineSvg("<svg><text>&#38;lt;script&#38;gt;</text></svg>", true);
    expect(result).not.toBeNull();
    expect(result!.innerHTML).toContain("&amp;lt;");
    expect(result!.innerHTML).not.toContain("<script");
  });
});

describe("hostile corpus: animations and mutation vectors", () => {
  const cases: { markup: string; expected: string }[] = [
    {
      markup: "<svg><animate attributeName='href' values='javascript:alert(1)'/><rect/></svg>",
      expected: "<rect/>",
    },
    {
      markup:
        "<svg><set attributeName='href' to='data:image/svg+xml;base64,PHN2Zy8+'/><rect/></svg>",
      expected: "<rect/>",
    },
  ];
  it.each(cases)("strips animation smuggling in $markup", ({ markup, expected }) => {
    const result = parseInlineSvg(markup, true);
    expect(result).not.toBeNull();
    expect(result!.innerHTML).toBe(expected);
  });

  it("drops comments carrying script markup", () => {
    const result = parseInlineSvg("<svg><!--<script>alert(1)</script>--><rect/></svg>", true);
    expect(result).not.toBeNull();
    expect(result!.innerHTML).toBe("<rect/>");
  });
});

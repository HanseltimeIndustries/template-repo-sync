const spacingRegex = /[{[]\n?(?<spacing>\s+)["tf\d]/;
export function inferJSONIndent(rawJSON: string) {
  const match = spacingRegex.exec(rawJSON);
  if (!match?.groups?.spacing) {
    // eslint-disable-next-line no-console
    console.warn(
      `Could not find json indentation for json string: ${rawJSON.slice(40)} ... \nDefaulting to 4 spaces`,
    );
    // Four spaces
    return "    ";
  }
  const spacing = match.groups.spacing;
  // Handle the case where there were multiple newlines before a value
  const lastNewLine = spacing.lastIndexOf("\n");
  return match?.groups.spacing.slice(lastNewLine >= 0 ? lastNewLine + 1 : 0);
}

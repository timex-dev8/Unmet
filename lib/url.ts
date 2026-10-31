/** The site a link points to, without "www." (the link itself if it isn't a valid URL). */
export function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

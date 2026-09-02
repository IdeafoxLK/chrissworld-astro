/**
 * Custom data-fetching helpers.
 *
 * This file is never overwritten by PhantomWP -- put project-specific
 * WordPress helpers here instead of editing the generated client.
 */
import {
    getCustomPostType,
    getPosts,
    getFeaturedImageUrl,
    getLocalImageUrl,
    stripHtml,
    IMAGE_SOURCE_MODE,
} from '@phantomwp/wordpress';

/** Normalised shape used by the home-page section components. */
export interface ContentCard {
    id: number;
    title: string;
    slug: string;
    excerpt: string;
    date: string;
    image: string | null;
}

/** WordPress escapes ampersands and friends in `title.rendered`. */
function decodeEntities(value: string): string {
    return value
        .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
        .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
        .replace(/&amp;/g, '&')
        .replace(/&nbsp;/g, ' ')
        .replace(/&quot;/g, '"')
        .replace(/&#0?39;/g, "'")
        .replace(/&lsquo;|&rsquo;/g, "'")
        .replace(/&ldquo;|&rdquo;/g, '"')
        .replace(/&ndash;/g, '-')
        .replace(/&mdash;/g, '--')
        .trim();
}

/**
 * Pick a featured image, resolving it to the locally synced copy.
 *
 * `getCustomPostType` does not run the framework's URL-rewriting pass (only
 * getPosts/getPages do), so custom-type featured images come back as remote
 * WordPress URLs. Route them through `getLocalImageUrl`, which matches on a
 * normalised filename and therefore also resolves size variants such as
 * `-1024x400` back to the full-size local file. It returns the original URL
 * when nothing matches, so this degrades safely.
 */
function pickFeaturedImage(item: any): string | null {
    if (IMAGE_SOURCE_MODE === 'cdn') {
        return getFeaturedImageUrl(item, 'large');
    }

    // Preferred: the 1024px variant resolved back to its local copy.
    const sized = getLocalImageUrl(getFeaturedImageUrl(item, 'large'));
    if (sized?.startsWith('/')) return sized;

    // The normaliser strips `-1024x477` but not WordPress's `-scaled` suffix,
    // so uploads stored as `name-scaled.webp` miss. Their full-size
    // `source_url` is a direct key in the media map, so retry with that.
    return getLocalImageUrl(getFeaturedImageUrl(item, 'full'));
}

function toCard(item: any): ContentCard {
    return {
        id: item.id,
        title: decodeEntities(item.title?.rendered ?? ''),
        slug: item.slug,
        excerpt: decodeEntities(stripHtml(item.excerpt?.rendered ?? '')),
        date: item.date ?? '',
        image: pickFeaturedImage(item),
    };
}

/**
 * Services (CPT `service`) -- the only custom type whose content, excerpt and
 * featured image are all exposed over REST, so it renders fully from WordPress.
 */
export async function getServices(limit = 6): Promise<ContentCard[]> {
    const items = await getCustomPostType('service', { perPage: limit });
    return items.map(toCard);
}

/** Latest news posts for the insights section. */
export async function getLatestNews(limit = 3): Promise<ContentCard[]> {
    const items = await getPosts({ perPage: limit });
    return items.map(toCard);
}

/**
 * Facilities (CPT `facility`). Only title + featured image come back over
 * REST -- the address/size fields live in ACF, which is not published to the
 * API, so cards stay image-and-name only.
 */
export async function getFacilities(limit = 6): Promise<ContentCard[]> {
    const items = await getCustomPostType('facility', { perPage: limit });
    return items.map(toCard);
}

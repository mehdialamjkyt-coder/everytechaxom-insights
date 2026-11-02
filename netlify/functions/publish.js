
const crypto = require("crypto");

const {
    ADMIN_EMAIL,
    ADMIN_PASSWORD,
    SESSION_SECRET,
    GITHUB_TOKEN,
    GITHUB_OWNER,
    GITHUB_REPO,
    GITHUB_BRANCH = "main"
} = process.env;

const FILE_PATH = "articles.json";

const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store"
};

function response(statusCode, data) {
    return {
        statusCode,
        headers,
        body: JSON.stringify(data)
    };
}

function safeEqual(a, b) {
    const first = Buffer.from(String(a));
    const second = Buffer.from(String(b));

    return first.length === second.length &&
        crypto.timingSafeEqual(first, second);
}

function createToken(email) {
    const payload = Buffer.from(JSON.stringify({
        email,
        exp: Date.now() + 8 * 60 * 60 * 1000
    })).toString("base64url");

    const signature = crypto
        .createHmac("sha256", SESSION_SECRET)
        .update(payload)
        .digest("base64url");

    return `${payload}.${signature}`;
}

function verifyToken(token) {
    if (!token || !SESSION_SECRET) return false;

    const parts = token.split(".");
    if (parts.length !== 2) return false;

    const [payload, signature] = parts;

    const expected = crypto
        .createHmac("sha256", SESSION_SECRET)
        .update(payload)
        .digest("base64url");

    if (!safeEqual(signature, expected)) return false;

    try {
        const data = JSON.parse(
            Buffer.from(payload, "base64url").toString()
        );

        return data.email === ADMIN_EMAIL &&
            data.exp > Date.now();
    } catch {
        return false;
    }
}

function getToken(event) {
    const auth = event.headers.authorization ||
        event.headers.Authorization || "";

    return auth.startsWith("Bearer ")
        ? auth.slice(7)
        : "";
}

function checkConfiguration() {
    const required = [
        ADMIN_EMAIL,
        ADMIN_PASSWORD,
        SESSION_SECRET,
        GITHUB_TOKEN,
        GITHUB_OWNER,
        GITHUB_REPO
    ];

    return required.every(Boolean);
}

// ======================================
// GITHUB API
// ======================================

async function githubRequest(method, body) {
    const url =
        `https://api.github.com/repos/${encodeURIComponent(GITHUB_OWNER)}/${encodeURIComponent(GITHUB_REPO)}/contents/${FILE_PATH}`;

    const result = await fetch(url, {
        method,
        headers: {
            "Authorization": `Bearer ${GITHUB_TOKEN}`,
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "Everytech-Axom-Insights"
        },
        body: body ? JSON.stringify(body) : undefined
    });

    const data = await result.json().catch(() => ({}));

    if (!result.ok) {
        throw new Error(
            data.message || `GitHub API error: ${result.status}`
        );
    }

    return data;
}

async function getArticles() {
    const file = await githubRequest("GET");

    const content = Buffer
        .from(file.content.replace(/\s/g, ""), "base64")
        .toString("utf8");

    const data = JSON.parse(content);

    if (!Array.isArray(data.articles)) {
        throw new Error("Invalid articles.json format.");
    }

    return {
        articles: data.articles,
        sha: file.sha
    };
}

async function saveArticles(articles, sha, message) {
    const content = Buffer
        .from(JSON.stringify({ articles }, null, 2))
        .toString("base64");

    return githubRequest("PUT", {
        message,
        content,
        sha,
        branch: GITHUB_BRANCH
    });
}

// ======================================
// INPUT VALIDATION
// ======================================

function validateArticle(article) {
    if (!article || typeof article !== "object") {
        throw new Error("Invalid article.");
    }

    const fields = [
        "id",
        "title",
        "slug",
        "category",
        "author",
        "description",
        "content",
        "status"
    ];

    for (const field of fields) {
        if (typeof article[field] !== "string") {
            throw new Error(`Invalid ${field}.`);
        }
    }

    if (
        article.title.length > 200 ||
        article.slug.length > 180 ||
        article.description.length > 1000 ||
        article.content.length > 200000
    ) {
        throw new Error("Article exceeds the allowed size.");
    }

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(article.slug)) {
        throw new Error("Invalid article URL slug.");
    }

    if (!["draft", "published"].includes(article.status)) {
        throw new Error("Invalid article status.");
    }

    if (!article.id || article.id.length > 100) {
        throw new Error("Invalid article ID.");
    }

    if (!article.title.trim() || !article.content.trim()) {
        throw new Error("Title and content are required.");
    }

    if (
        article.thumbnail &&
        !/^https:\/\//i.test(article.thumbnail)
    ) {
        throw new Error("Thumbnail must use an HTTPS URL.");
    }
}

// ======================================
// MAIN HANDLER
// ======================================

exports.handler = async function(event) {

    if (event.httpMethod !== "POST") {
        return response(405, {
            success: false,
            message: "Method not allowed."
        });
    }

    if (!checkConfiguration()) {
        return response(500, {
            success: false,
            message: "Server configuration is incomplete."
        });
    }

    try {

        if (!event.body || event.body.length > 250000) {
            return response(413, {
                success: false,
                message: "Request is too large."
            });
        }

        const body = JSON.parse(event.body);
        const action = body.action;

        // ADMIN LOGIN

        if (action === "login") {

            const email = String(body.email || "");
            const password = String(body.password || "");

            if (
                !safeEqual(email.toLowerCase(), ADMIN_EMAIL.toLowerCase()) ||
                !safeEqual(password, ADMIN_PASSWORD)
            ) {
                return response(401, {
                    success: false,
                    message: "Incorrect email or password."
                });
            }

            return response(200, {
                success: true,
                token: createToken(ADMIN_EMAIL),
                message: "Login successful."
            });
        }

        // VERIFY ADMIN SESSION

        if (!verifyToken(getToken(event))) {
            return response(401, {
                success: false,
                message: "Unauthorized. Please login again."
            });
        }

        // LIST ARTICLES

        if (action === "list") {

            const data = await getArticles();

            return response(200, {
                success: true,
                articles: data.articles
            });
        }

        // SAVE OR UPDATE ARTICLE

        if (action === "save") {

            const article = body.article;

            validateArticle(article);

            const data = await getArticles();

            const duplicate = data.articles.find(item =>
                item.slug === article.slug &&
                item.id !== article.id
            );

            if (duplicate) {
                return response(409, {
                    success: false,
                    message: "This article URL already exists."
                });
            }

            const index = data.articles.findIndex(
                item => item.id === article.id
            );

            const now = new Date().toISOString();

            if (index >= 0) {

                article.createdAt =
                    data.articles[index].createdAt || now;

                data.articles[index] = article;

            } else {

                article.createdAt = now;
                data.articles.unshift(article);

            }

            article.updatedAt = now;

            await saveArticles(
                data.articles,
                data.sha,
                `${article.status === "published" ? "Publish" : "Save"} article: ${article.title}`
            );

            return response(200, {
                success: true,
                message: "Article saved successfully."
            });
        }

        // DELETE ARTICLE

        if (action === "delete") {

            const id = String(body.id || "");

            if (!id) {
                throw new Error("Article ID is required.");
            }

            const data = await getArticles();

            const updated = data.articles.filter(
                article => article.id !== id
            );

            if (updated.length === data.articles.length) {
                return response(404, {
                    success: false,
                    message: "Article not found."
                });
            }

            await saveArticles(
                updated,
                data.sha,
                `Delete article: ${id}`
            );

            return response(200, {
                success: true,
                message: "Article deleted successfully."
            });
        }

        return response(400, {
            success: false,
            message: "Unknown action."
        });

    } catch (error) {

        console.error("Admin API Error:", error.message);

        return response(500, {
            success: false,
            message: "Server error. Please check configuration and try again."
        });

    }
};

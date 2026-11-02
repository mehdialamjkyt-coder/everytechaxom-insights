
/* =========================================
   EVERYTECH AXOM INSIGHTS
   Main JavaScript Engine
========================================= */

const CONFIG = {
  articlesFile: "./articles.json",
  articlesPerPage: 9,
  siteName: "Everytech Axom Insights"
};

let allArticles = [];
let activeCategory = "All";
let searchQuery = "";
let currentPage = 1;

// DOM ELEMENTS
const articleContainer = document.querySelector(".articles");
const searchInput = document.querySelector(".search input");
const searchButton = document.querySelector(".search button");
const categoryButtons = document.querySelectorAll(".category");

// SAFE TEXT HELPER
function createElement(tag, className, text) {
  const element = document.createElement(tag);

  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;

  return element;
}

// LOAD ARTICLES
async function loadArticles() {
  if (!articleContainer) return;

  try {
    const response = await fetch(
      CONFIG.articlesFile + "?v=" + Date.now()
    );

    if (!response.ok) {
      throw new Error("Articles file not found");
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error("Invalid article data");
    }

    allArticles = data.filter(article =>
      article &&
      typeof article.title === "string" &&
      typeof article.slug === "string"
    );

    allArticles.sort((a, b) =>
      new Date(b.date || 0) - new Date(a.date || 0)
    );

    openSelectedArticle();
    renderArticles();

  } catch (error) {
    console.error("Article loading error:", error);

    articleContainer.replaceChildren(
      createElement(
        "p",
        "empty-message",
        "Articles could not be loaded. Please try again later."
      )
    );
  }
}

// CREATE ARTICLE CARD
function createArticleCard(article) {
  const card = createElement("article", "article");

  const link = createElement("a");
  link.href = "?article=" + encodeURIComponent(article.slug);
  link.style.textDecoration = "none";
  link.style.color = "inherit";

  if (article.image) {
    const image = createElement("img");
    image.src = article.image;
    image.alt = article.title;
    image.loading = "lazy";
    image.onerror = () => image.remove();

    link.appendChild(image);
  }

  const content = createElement("div", "article-content");

  content.appendChild(
    createElement("small", "", article.category || "Technology")
  );

  content.appendChild(
    createElement("h3", "", article.title)
  );

  content.appendChild(
    createElement(
      "p",
      "",
      article.excerpt || "Explore this technology article."
    )
  );

  const meta = createElement("p");
  meta.style.marginTop = "14px";
  meta.style.fontSize = "12px";

  meta.textContent =
    (article.author || "Everytech Axom") +
    " • " +
    (article.date || "");

  content.appendChild(meta);
  link.appendChild(content);
  card.appendChild(link);

  return card;
}

// FILTER ARTICLES
function getFilteredArticles() {
  return allArticles.filter(article => {
    const categoryMatch =
      activeCategory === "All" ||
      (article.category || "").toLowerCase() ===
      activeCategory.toLowerCase();

    const searchableText = [
      article.title,
      article.excerpt,
      article.category,
      ...(article.tags || [])
    ].join(" ").toLowerCase();

    const searchMatch =
      searchableText.includes(searchQuery.toLowerCase());

    return categoryMatch && searchMatch;
  });
}

// RENDER ARTICLES
function renderArticles() {
  if (!articleContainer) return;

  const filtered = getFilteredArticles();

  articleContainer.replaceChildren();

  if (filtered.length === 0) {
    articleContainer.appendChild(
      createElement(
        "p",
        "empty-message",
        "No articles found. Try another search or category."
      )
    );
    return;
  }

  const start = (currentPage - 1) * CONFIG.articlesPerPage;

  const visibleArticles = filtered.slice(
    start,
    start + CONFIG.articlesPerPage
  );

  visibleArticles.forEach(article => {
    articleContainer.appendChild(
      createArticleCard(article)
    );
  });

  renderPagination(filtered.length);
}

// PAGINATION
function renderPagination(total) {
  const oldPagination = document.querySelector(".pagination");

  if (oldPagination) oldPagination.remove();

  const totalPages = Math.ceil(
    total / CONFIG.articlesPerPage
  );

  if (totalPages <= 1) return;

  const pagination = createElement("div", "pagination");

  pagination.style.display = "flex";
  pagination.style.justifyContent = "center";
  pagination.style.gap = "12px";
  pagination.style.marginTop = "35px";

  const previous = createElement("button", "", "Previous");
  const next = createElement("button", "", "Next");

  [previous, next].forEach(button => {
    button.style.padding = "10px 18px";
    button.style.border = "1px solid #ddd";
    button.style.borderRadius = "8px";
    button.style.background = "#fff";
  });

  previous.disabled = currentPage === 1;
  next.disabled = currentPage === totalPages;

  previous.addEventListener("click", () => {
    currentPage--;
    renderArticles();
    scrollToArticles();
  });

  next.addEventListener("click", () => {
    currentPage++;
    renderArticles();
    scrollToArticles();
  });

  pagination.append(previous, next);

  articleContainer.after(pagination);
}

// CATEGORY FILTER
categoryButtons.forEach(button => {
  button.addEventListener("click", () => {
    activeCategory = button.textContent.trim();
    currentPage = 1;

    categoryButtons.forEach(item =>
      item.classList.remove("active")
    );

    button.classList.add("active");

    renderArticles();
  });
});

// SEARCH
function performSearch() {
  searchQuery = searchInput.value.trim();
  currentPage = 1;
  renderArticles();
}

if (searchButton) {
  searchButton.addEventListener("click", performSearch);
}

if (searchInput) {
  searchInput.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      performSearch();
    }
  });

  searchInput.addEventListener("input", () => {
    if (!searchInput.value.trim()) {
      searchQuery = "";
      currentPage = 1;
      renderArticles();
    }
  });
}

// ARTICLE READING PAGE
function openSelectedArticle() {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get("article");

  if (!slug) return;

  const article = allArticles.find(item =>
    item.slug === slug
  );

  if (!article) {
    articleContainer.replaceChildren(
      createElement(
        "p",
        "empty-message",
        "Article not found."
      )
    );
    return;
  }

  document.title = article.title + " | " + CONFIG.siteName;

  const main = document.querySelector("main");

  main.replaceChildren();

  const wrapper = createElement("article");
  wrapper.style.maxWidth = "850px";
  wrapper.style.margin = "auto";

  const back = createElement("a", "", "← Back to Articles");
  back.href = window.location.pathname;
  back.style.color = "#155eef";
  back.style.textDecoration = "none";

  wrapper.appendChild(back);

  wrapper.appendChild(
    createElement("small", "", article.category || "Technology")
  );

  const title = createElement("h1", "", article.title);
  title.style.fontSize = "clamp(30px, 5vw, 48px)";
  title.style.lineHeight = "1.2";
  title.style.margin = "25px 0";

  wrapper.appendChild(title);

  wrapper.appendChild(
    createElement(
      "p",
      "",
      (article.author || "Everytech Axom") +
      " • " +
      (article.date || "")
    )
  );

  if (article.image) {
    const image = createElement("img");
    image.src = article.image;
    image.alt = article.title;
    image.style.width = "100%";
    image.style.borderRadius = "16px";
    image.style.margin = "25px 0";
    image.onerror = () => image.remove();

    wrapper.appendChild(image);
  }

  const body = createElement("div");
  body.style.fontSize = "17px";
  body.style.lineHeight = "1.9";
  body.style.color = "#475467";
  body.style.whiteSpace = "pre-wrap";
  body.style.overflowWrap = "anywhere";
  body.style.marginTop = "25px";

  body.textContent = article.content || article.excerpt || "";

  wrapper.appendChild(body);

  main.appendChild(wrapper);

  window.scrollTo(0, 0);
}

// SCROLL HELPER
function scrollToArticles() {
  document.querySelector("#articles")?.scrollIntoView({
    behavior: "smooth"
  });
}

// START WEBSITE
document.addEventListener("DOMContentLoaded", loadArticles);

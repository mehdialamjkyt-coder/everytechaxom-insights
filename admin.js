
/* =========================================
   EVERYTECH AXOM INSIGHTS
   ADMIN DASHBOARD SYSTEM
   ========================================= */

const API_URL = "/.netlify/functions/publish";

let articles = [];
let editingArticleId = null;
let adminToken = sessionStorage.getItem("ea_admin_token");

// =========================================
// API REQUEST SYSTEM
// =========================================

async function apiRequest(action, data = {}) {

    const headers = {
        "Content-Type": "application/json"
    };

    if (adminToken) {
        headers.Authorization = `Bearer ${adminToken}`;
    }

    const response = await fetch(API_URL, {
        method: "POST",
        headers,
        body: JSON.stringify({
            action,
            ...data
        })
    });

    let result;

    try {
        result = await response.json();
    } catch {
        throw new Error("Invalid server response.");
    }

    if (!response.ok || result.success === false) {
        throw new Error(result.message || "Something went wrong.");
    }

    return result;
}


// =========================================
// DOM ELEMENTS
// =========================================

const loginScreen = document.getElementById("loginScreen");
const dashboard = document.getElementById("dashboard");

const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");

const logoutBtn = document.getElementById("logoutBtn");

const articleForm = document.getElementById("articleForm");
const articleTable = document.getElementById("articleTable");

const totalArticles = document.getElementById("totalArticles");
const publishedArticles = document.getElementById("publishedArticles");
const draftArticles = document.getElementById("draftArticles");

const message = document.getElementById("message");


// =========================================
// HELPER FUNCTIONS
// =========================================

function showMessage(text, success = true) {

    message.textContent = text;

    message.style.color = success
        ? "#62dca1"
        : "#ff7777";
}


function makeSlug(text) {

    return text
        .toLowerCase()
        .trim()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
}


function createArticleId() {

    if (window.crypto && crypto.randomUUID) {
        return crypto.randomUUID();
    }

    return "article-" + Date.now() + "-" +
        Math.random().toString(36).slice(2, 8);
}


function formatDate(date) {

    if (!date) return "Recently";

    return new Date(date).toLocaleDateString("en-IN");
}


// =========================================
// LOGIN SYSTEM
// =========================================

loginForm.addEventListener("submit", async function(event) {

    event.preventDefault();

    const email = document.getElementById("adminEmail").value.trim();
    const password = document.getElementById("adminPassword").value;

    const button = loginForm.querySelector("button");

    button.disabled = true;
    button.textContent = "Logging in...";

    loginMessage.textContent = "";

    try {

        const result = await apiRequest("login", {
            email,
            password
        });

        if (!result.token) {
            throw new Error("Server did not return an access token.");
        }

        adminToken = result.token;

        sessionStorage.setItem("ea_admin_token", adminToken);

        document.getElementById("adminPassword").value = "";

        await loadDashboard();

    } catch(error) {

        loginMessage.textContent = error.message;
        loginMessage.style.color = "#ff7777";

        adminToken = null;
        sessionStorage.removeItem("ea_admin_token");

    } finally {

        button.disabled = false;
        button.textContent = "Login to Dashboard";

    }

});


// =========================================
// DASHBOARD ACCESS
// =========================================

function openDashboard() {

    loginScreen.style.display = "none";
    dashboard.style.display = "block";

}


function openLogin() {

    dashboard.style.display = "none";
    loginScreen.style.display = "flex";

    loginForm.reset();

}


async function loadDashboard() {

    try {

        openDashboard();

        await loadArticles();

        showSection("overview");

    } catch(error) {

        logout();

        loginMessage.textContent =
            "Session expired or access denied. Please login again.";

        loginMessage.style.color = "#ff7777";

    }

}


// =========================================
// LOGOUT
// =========================================

function logout() {

    adminToken = null;

    sessionStorage.removeItem("ea_admin_token");

    articles = [];

    openLogin();

}


logoutBtn.addEventListener("click", logout);


// =========================================
// NAVIGATION SYSTEM
// =========================================

function showSection(sectionId) {

    document.querySelectorAll(".dashboard-section, .editor-section")
        .forEach(section => {

            section.classList.add("hidden");
            section.classList.remove("active");

        });

    const selected = document.getElementById(sectionId);

    if (selected) {

    selected.classList.remove("hidden");

    if (sectionId === "overview") {
        selected.classList.remove("active");
    } else {
        selected.classList.add("active");
    }

}

    const titles = {
        overview: "Dashboard Overview",
        editor: "Article Editor",
        articles: "Manage Articles"
    };

    document.getElementById("pageTitle").textContent =
        titles[sectionId] || "Dashboard";

    document.querySelectorAll(".sidebar button[data-section]")
        .forEach(button => {

            button.classList.toggle(
                "active",
                button.dataset.section === sectionId
            );

        });

}


document.querySelectorAll(".sidebar button[data-section]")
    .forEach(button => {

        button.addEventListener("click", () => {

            showSection(button.dataset.section);

            if (button.dataset.section === "articles") {
                loadArticles();
            }

        });

    });


document.getElementById("createArticleBtn")
    .addEventListener("click", () => {

        resetEditor();
        showSection("editor");

    });


document.getElementById("viewWebsite")
    .addEventListener("click", () => {

        window.open("/", "_blank", "noopener,noreferrer");

    });


// =========================================
// LOAD ARTICLES
// =========================================

async function loadArticles() {

    const result = await apiRequest("list");

    articles = Array.isArray(result.articles)
        ? result.articles
        : [];

    updateStatistics();

    renderArticles();

}


// =========================================
// DASHBOARD STATISTICS
// =========================================

function updateStatistics() {

    const published = articles.filter(
        article => article.status === "published"
    ).length;

    const drafts = articles.filter(
        article => article.status === "draft"
    ).length;

    totalArticles.textContent = articles.length;

    publishedArticles.textContent = published;

    draftArticles.textContent = drafts;

}


// =========================================
// RENDER ARTICLE TABLE
// =========================================

function renderArticles() {

    articleTable.replaceChildren();

    if (articles.length === 0) {

        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 4;
        cell.textContent = "No articles found. Create your first article!";

        row.appendChild(cell);
        articleTable.appendChild(row);

        return;

    }

    articles.forEach(article => {

        const row = document.createElement("tr");

        const titleCell = document.createElement("td");
        titleCell.textContent = article.title || "Untitled";

        const categoryCell = document.createElement("td");
        categoryCell.textContent = article.category || "General";

        const statusCell = document.createElement("td");
        statusCell.textContent = article.status || "draft";
        statusCell.className = "status";

        const actionCell = document.createElement("td");

        const editButton = document.createElement("button");

        editButton.className = "secondary-btn";
        editButton.textContent = "Edit";

        editButton.addEventListener("click", () => {
            editArticle(article.id);
        });

        const deleteButton = document.createElement("button");

        deleteButton.className = "danger-btn";
        deleteButton.textContent = "Delete";
        deleteButton.style.marginLeft = "7px";

        deleteButton.addEventListener("click", () => {
            deleteArticle(article.id);
        });

        actionCell.append(editButton, deleteButton);

        row.append(
            titleCell,
            categoryCell,
            statusCell,
            actionCell
        );

        articleTable.appendChild(row);

    });

}


// =========================================
// AUTOMATIC SLUG GENERATION
// =========================================

const titleInput = document.getElementById("title");
const slugInput = document.getElementById("slug");

titleInput.addEventListener("input", () => {

    if (!editingArticleId) {
        slugInput.value = makeSlug(titleInput.value);
    }

});


// =========================================
// RESET ARTICLE EDITOR
// =========================================

function resetEditor() {

    articleForm.reset();

    editingArticleId = null;

    document.getElementById("articleId").value = "";

    document.getElementById("author").value = "Mehdi Alam";

    document.getElementById("editorTitle").textContent =
        "Create New Article";

    showMessage("");

}


// =========================================
// SAVE ARTICLE
// =========================================

async function saveArticle(status) {

    const title = titleInput.value.trim();
    const slug = slugInput.value.trim();

    if (!title || !slug) {

        showMessage("Please enter article title and URL slug.", false);
        return;

    }

    const article = {

        id: editingArticleId || createArticleId(),

        title,

        slug,

        category: document.getElementById("category").value,

        author: document.getElementById("author").value.trim(),

        thumbnail: document.getElementById("thumbnail").value.trim(),

        description: document.getElementById("description").value.trim(),

        content: document.getElementById("content").value,

        status,

        updatedAt: new Date().toISOString()

    };

    if (status === "published" && !article.description) {

        showMessage("Please write an article description.", false);
        return;

    }

    const buttons = articleForm.querySelectorAll("button");

    buttons.forEach(button => button.disabled = true);

    showMessage("Saving article...");

    try {

        const result = await apiRequest("save", {
            article
        });

        await loadArticles();

        resetEditor();

        showMessage(
            result.message || "Article saved successfully!"
        );

        showSection("articles");

    } catch(error) {

        showMessage(error.message, false);

    } finally {

        buttons.forEach(button => button.disabled = false);

    }

}


// =========================================
// PUBLISH ARTICLE
// =========================================

articleForm.addEventListener("submit", async function(event) {

    event.preventDefault();

    await saveArticle("published");

});


// =========================================
// SAVE DRAFT
// =========================================

document.getElementById("draftBtn")
    .addEventListener("click", async () => {

        await saveArticle("draft");

    });


// =========================================
// EDIT ARTICLE
// =========================================

function editArticle(id) {

    const article = articles.find(item => item.id === id);

    if (!article) return;

    editingArticleId = article.id;

    document.getElementById("articleId").value = article.id;

    document.getElementById("title").value = article.title || "";

    document.getElementById("slug").value = article.slug || "";

    document.getElementById("category").value = article.category || "";

    document.getElementById("author").value = article.author || "";

    document.getElementById("thumbnail").value = article.thumbnail || "";

    document.getElementById("description").value = article.description || "";

    document.getElementById("content").value = article.content || "";

    document.getElementById("editorTitle").textContent =
        "Edit Article";

    showMessage("");

    showSection("editor");

}


// =========================================
// DELETE ARTICLE
// =========================================

async function deleteArticle(id) {

    const article = articles.find(item => item.id === id);

    if (!article) return;

    const confirmed = confirm(
        `Are you sure you want to delete "${article.title}"?`
    );

    if (!confirmed) return;

    try {

        await apiRequest("delete", {
            id
        });

        await loadArticles();

        showSection("articles");

    } catch(error) {

        alert("Delete failed: " + error.message);

    }

}


// =========================================
// INITIAL SESSION CHECK
// =========================================

if (adminToken) {

    loadDashboard();

} else {

    openLogin();

}

console.log("Everytech Axom Admin System Loaded");

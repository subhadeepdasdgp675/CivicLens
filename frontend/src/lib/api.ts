// ── Centralized API client ──
// Handles JWT token management, error handling, and typed requests.

// VITE_API_URL is set at Vercel build time or defaults to live Railway backend in production
const BACKEND_URL =
    import.meta.env.VITE_API_URL ||
    (import.meta.env.PROD ? "https://civiclens-production-3c12.up.railway.app" : "");
const API_BASE = `${BACKEND_URL}/api`;

function getToken(): string | null {
    return localStorage.getItem("civiclens_token") || localStorage.getItem("civicconnect_token");
}

function setToken(token: string) {
    localStorage.setItem("civiclens_token", token);
}

function removeToken() {
    localStorage.removeItem("civiclens_token");
    localStorage.removeItem("civicconnect_token");
}

function authHeaders(): HeadersInit {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
}

export class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
        super(message);
        this.status = status;
        this.name = "ApiError";
    }
}

async function request<T>(
    path: string,
    options: RequestInit = {}
): Promise<T> {
    const url = `${API_BASE}${path}`;
    const headers: Record<string, string> = {
        ...(authHeaders() as Record<string, string>),
        ...(options.headers as Record<string, string> || {}),
    };

    // Don't set Content-Type for FormData (browser sets multipart boundary)
    if (!(options.body instanceof FormData)) {
        headers["Content-Type"] = "application/json";
    }

    const res = await fetch(url, { ...options, headers });

    if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new ApiError(body.error || "Something went wrong.", res.status);
    }

    // Handle empty responses (204 No Content)
    if (res.status === 204) return {} as T;

    return res.json();
}

// ── Auth ──

export const auth = {
    quickAdminLogin: (targetCity?: string) =>
        request<{ user: ApiUser; token: string; message: string }>("/auth/admin-quick-login", {
            method: "POST",
            body: JSON.stringify({ targetCity }),
        }),

    login: (email: string, password: string) =>
        request<{ user: ApiUser; token: string; message: string }>("/auth/login", {
            method: "POST",
            body: JSON.stringify({ email, password }),
        }),

    loginWithOtp: (email: string, otp: string) =>
        request<{ user: ApiUser; token: string; message: string }>("/auth/verify-login-otp", {
            method: "POST",
            body: JSON.stringify({ email, otp }),
        }),

    sendLoginOtp: (email: string) =>
        request<{ message: string }>("/auth/send-login-otp", {
            method: "POST",
            body: JSON.stringify({ email }),
        }),

    sendSignupOtp: (name: string, email: string, city: string) =>
        request<{ message: string }>("/auth/send-signup-otp", {
            method: "POST",
            body: JSON.stringify({ name, email, city }),
        }),

    register: (name: string, email: string, city: string, otp: string, password?: string) =>
        request<{ user: ApiUser; token: string; message: string }>("/auth/register", {
            method: "POST",
            body: JSON.stringify({ name, email, city, otp, password: password || undefined }),
        }),

    me: () => request<{ user: ApiUser }>("/auth/me"),

    forgotPassword: (email: string) =>
        request<{ message: string }>("/auth/forgot-password", {
            method: "POST",
            body: JSON.stringify({ email }),
        }),

    verifyOtp: (email: string, otp: string) =>
        request<{ message: string; resetToken: string }>("/auth/verify-otp", {
            method: "POST",
            body: JSON.stringify({ email, otp }),
        }),

    resetPassword: (email: string, otp: string, newPassword: string) =>
        request<{ message: string }>("/auth/reset-password", {
            method: "POST",
            body: JSON.stringify({ email, otp, newPassword }),
        }),
};

// ── Issues ──

export const issues = {
    list: (params?: Record<string, string>) => {
        const qs = params ? "?" + new URLSearchParams(params).toString() : "";
        return request<{ issues: ApiIssue[]; pagination: ApiPagination }>(`/issues${qs}`);
    },

    nearby: (lat: number, lng: number, radius?: number) => {
        const params = new URLSearchParams({ lat: String(lat), lng: String(lng) });
        if (radius) params.set("radius", String(radius));
        return request<{ issues: ApiIssue[] }>(`/issues/nearby?${params}`);
    },

    getById: (id: string) =>
        request<{ issue: ApiIssueDetail }>(`/issues/${id}`),

    report: (formData: FormData) =>
        request<{ message: string; issue: ApiIssue; isDuplicate: boolean }>("/issues", {
            method: "POST",
            body: formData,
        }),

    reportGuest: (formData: FormData) => {
        // Unauthenticated — use plain fetch, no Authorization header
        return fetch(`${API_BASE}/issues/guest`, { method: "POST", body: formData })
            .then(async (res) => {
                if (!res.ok) {
                    const body = await res.json().catch(() => ({ error: res.statusText }));
                    throw new ApiError(body.error || "Something went wrong.", res.status);
                }
                return res.json() as Promise<{ message: string; issue: ApiIssue; isDuplicate: boolean }>;
            });
    },

    upvote: (id: string) =>
        request<{ message: string; upvoted: boolean }>(`/issues/${id}/upvote`, {
            method: "POST",
        }),

    addComment: (id: string, content: string) =>
        request<{ message: string; comment: ApiComment }>(`/issues/${id}/comments`, {
            method: "POST",
            body: JSON.stringify({ content }),
        }),

    getComments: (id: string, params?: Record<string, string>) => {
        const qs = params ? "?" + new URLSearchParams(params).toString() : "";
        return request<{ comments: ApiComment[]; pagination: { nextCursor: string | null; total: number; hasMore: boolean } }>(`/issues/${id}/comments${qs}`);
    },

    mapData: (params?: Record<string, string>) => {
        const qs = params ? "?" + new URLSearchParams(params).toString() : "";
        return request<{ issues: ApiMapIssue[] }>(`/issues/map${qs}`);
    },

    byUser: (userId: string, params?: Record<string, string>) => {
        const qs = params ? "?" + new URLSearchParams(params).toString() : "";
        return request<{ issues: ApiIssue[]; pagination: ApiPagination }>(`/issues/user/${userId}${qs}`);
    },

    upvoted: () =>
        request<{ issues: ApiIssue[] }>("/issues/upvoted"),

    dispute: (id: string, disputeReason: string) =>
        request<{ message: string; issue: ApiIssue }>(`/issues/${id}/dispute`, {
            method: "POST",
            body: JSON.stringify({ disputeReason }),
        }),
};


// ── Tickets (Department) ──

export const tickets = {
    list: (params?: Record<string, string>) => {
        const qs = params ? "?" + new URLSearchParams(params).toString() : "";
        return request<{ tickets: ApiTicket[]; pagination: ApiPagination }>(`/tickets${qs}`);
    },

    getById: (id: string) =>
        request<{ ticket: ApiTicketDetail }>(`/tickets/${id}`),

    updateStatus: (id: string, status: string, resolutionComment?: string, proofFile?: File) => {
        const formData = new FormData();
        formData.append("status", status);
        if (resolutionComment) formData.append("resolutionComment", resolutionComment);
        if (proofFile) formData.append("proofImage", proofFile);
        return request<{ message: string; ticket: ApiTicket }>(`/tickets/${id}/status`, {
            method: "PATCH",
            body: formData,
        });
    },

    uploadProof: (id: string, file: File) => {
        const formData = new FormData();
        formData.append("proofImage", file);
        return request<{ message: string; ticket: ApiTicket }>(`/tickets/${id}/proof`, {
            method: "POST",
            body: formData,
        });
    },

    stats: () =>
        request<{ stats: ApiTicketStats }>("/tickets/stats"),
};

// ── Municipal ──

export const municipal = {
    overview: (params?: Record<string, string>) => {
        const qs = params ? "?" + new URLSearchParams(params).toString() : "";
        return request<{ city: string; overview: ApiOverviewStats; departments: ApiDeptStat[]; citizenCount: number; recentIssuesCount: number }>(
            `/municipal/overview${qs}`
        );
    },

    departments: (params?: Record<string, string>) => {
        const qs = params ? "?" + new URLSearchParams(params).toString() : "";
        return request<{ departments: ApiDeptPerf[] }>(`/municipal/departments${qs}`);
    },

    escalations: (params?: Record<string, string>) => {
        const qs = params ? "?" + new URLSearchParams(params).toString() : "";
        return request<{ escalations: ApiEscalation[]; pagination: ApiPagination }>(`/municipal/escalations${qs}`);
    },

    exportReport: (format?: string, params?: Record<string, string>) => {
        const search = new URLSearchParams(params || {});
        if (format) search.set("format", format);
        const qs = search.toString() ? `?${search.toString()}` : "";
        return request<ApiExportReport>(`/municipal/reports/export${qs}`);
    },

    reportAnalytics: (params?: Record<string, string>) => {
        const qs = params ? "?" + new URLSearchParams(params).toString() : "";
        return request<ApiReportAnalytics>(`/municipal/reports/analytics${qs}`);
    },

    updateIssueStatus: (id: string, status: string, resolutionComment?: string) => {
        return request<{ message: string; issue: ApiIssue; status: string; displayStatus: string }>(
            `/municipal/issues/${id}/status`,
            {
                method: "PATCH",
                body: JSON.stringify({ status, resolutionComment }),
            }
        );
    },
};

// ── Notifications ──

export const notifications = {
    list: (unreadOnly?: boolean) => {
        const qs = unreadOnly ? "?unreadOnly=true" : "";
        return request<{ notifications: ApiNotification[]; unreadCount: number }>(
            `/notifications${qs}`
        );
    },

    markRead: (id: string) =>
        request<{ message: string }>(`/notifications/${id}/read`, { method: "PATCH" }),

    markAllRead: () =>
        request<{ message: string }>("/notifications/read-all", { method: "PATCH" }),
};

// ── Token management (used by AuthContext) ──

export { getToken, setToken, removeToken };

// ── API Response Types ──
// These mirror the shapes returned by the backend controllers.

export interface ApiUser {
    id: string;
    name: string;
    email: string;
    role: "citizen" | "department" | "municipal";
    avatar: string | null;
    createdAt: string;
    city: { id: string; name: string } | null;
    department?: { id: string; name: string } | null;
    cityId?: string;
    departmentId?: string | null;
}

export interface ApiIssue {
    id: string;
    title: string;
    description: string;
    category: string;
    location: string;
    lat: number;
    lng: number;
    image: string;
    status: string;
    reporters: number;
    createdAt: string;
    updatedAt: string;
    reportedBy?: { id: string; name: string; role: string };
    city?: { id: string; name: string };
    _count?: { comments: number; upvotes: number };
    consolidatedTicketId?: string;
}

export interface ApiIssueDetail extends ApiIssue {
    comments: ApiComment[];
    upvotes: { userId: string }[];
    consolidatedTicket?: {
        id: string;
        status: string;
        proofImage: string | null;
        resolutionComment: string | null;
        escalatedAt: string | null;
        resolvedAt: string | null;
    };
}

export interface ApiComment {
    id: string;
    content: string;
    image: string | null;
    isDepartmentUpdate: boolean;
    createdAt: string;
    user: { id: string; name: string; role: string; avatar?: string | null };
}

export interface ApiPagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export interface ApiTicket {
    id: string;
    status: string;
    proofImage: string | null;
    resolutionComment: string | null;
    escalatedAt: string | null;
    resolvedAt: string | null;
    createdAt: string;
    updatedAt: string;
    department: { id: string; name: string };
    city: { id: string; name: string };
    issuePosts: ApiTicketIssue[];
    _count?: { issuePosts: number };
}

export interface ApiTicketIssue {
    id: string;
    title: string;
    description: string;
    category: string;
    location: string;
    lat: number;
    lng: number;
    image: string;
    reporters: number;
    createdAt: string;
    reportedBy?: { id: string; name: string };
}

export interface ApiTicketDetail extends ApiTicket {
    totalReporters: number;
    totalIssuePosts: number;
    issuePosts: (ApiTicketIssue & {
        comments: ApiComment[];
        _count?: { upvotes: number };
        reportedBy?: { id: string; name: string; role: string; avatar?: string | null };
    })[];
}

export interface ApiTicketStats {
    total: number;
    pending: number;
    ongoing: number;
    resolved: number;
    escalated: number;
    avgResolutionDays: number;
}

export interface ApiOverviewStats {
    total: number;
    pending: number;
    ongoing: number;
    resolved: number;
    escalated: number;
    resolutionRate: number;
}

export interface ApiDeptStat {
    department: string;
    departmentId: string;
    categoryType: string;
    total: number;
    pending: number;
    ongoing: number;
    resolved: number;
    escalated: number;
}

export interface ApiDeptPerf {
    department: string;
    departmentId: string;
    categoryType: string;
    total: number;
    pending: number;
    ongoing: number;
    resolved: number;
    escalated: number;
    resolutionRate: number;
    avgResolutionDays: number;
}

export interface ApiEscalation {
    id: string;
    status: string;
    escalatedAt: string | null;
    createdAt: string;
    department: { id: string; name: string };
    issuePosts: {
        id: string;
        title: string;
        location: string;
        lat: number;
        lng: number;
        category: string;
        reporters: number;
        createdAt: string;
    }[];
}

export interface ApiNotification {
    id: string;
    userId: string;
    title: string;
    message: string;
    type: "info" | "success" | "warning" | "error";
    read: boolean;
    issuePostId: string | null;
    createdAt: string;
}

export interface ApiExportReport {
    city: string;
    report: ApiOverviewStats;
    departmentBreakdown: { department: string; count: number; pending: number; ongoing: number; resolved: number; escalated: number }[];
    generatedAt: string;
}

export interface ApiMapIssue {
    id: string;
    title: string;
    category: string;
    location: string;
    lat: number;
    lng: number;
    status: string;
    reporters: number;
    createdAt: string;
    consolidatedTicket?: {
        departmentId: string;
        department: { name: string };
    } | null;
}

export interface ApiReportAnalytics {
    monthlyTrend: { month: string; created: number; resolved: number }[];
    categoryBreakdown: { category: string; count: number }[];
    departmentAnalysis: { department: string; departmentId: string; total: number; resolved: number; resolutionRate: number }[];
    insights: {
        bestDepartment: { department: string; resolutionRate: number } | null;
        worstDepartment: { department: string; resolutionRate: number } | null;
    };
}

// Category display name mapping (backend uses PascalCase without spaces)
export const CATEGORY_DISPLAY: Record<string, string> = {
    Garbage: "Garbage",
    Pothole: "Pothole",
    WaterOverflow: "Water Overflow",
    StreetLight: "Street Light",
    Drainage: "Drainage",
    Footpath: "Footpath",
    Other: "Other",
};

export const CATEGORY_API_VALUE: Record<string, string> = {
    Garbage: "Garbage",
    Pothole: "Pothole",
    "Water Overflow": "WaterOverflow",
    "Street Light": "StreetLight",
    Drainage: "Drainage",
    Footpath: "Footpath",
    Other: "Other",
};

// ── CivicLens AI Intelligence Types & API ──

export type IncidentDecision = "SAME_INCIDENT" | "RELATED_INCIDENT" | "NEW_INCIDENT" | "NEEDS_REVIEW";
export type ReviewStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "OVERRIDDEN";
export type TimelineSource = "CITIZEN" | "GEMMA_AI" | "OFFICER" | "SYSTEM";

export interface ApiIncidentAssessment {
    id: string;
    issuePostId: string;
    candidateTicketId: string | null;
    decision: IncidentDecision;
    confidence: number;
    explanation: string;
    evidence: {
        categoryMatch?: boolean;
        distanceMeters?: number | null;
        semanticSimilarity?: string;
        temporalDifferenceHours?: number | null;
        imageObservations?: string;
        [key: string]: any;
    };
    uncertainties: string[];
    model: string;
    requiresReview: boolean;
    reviewStatus: ReviewStatus;
    createdAt: string;
    updatedAt: string;
    candidateTicket?: {
        id: string;
        department?: { name: string };
        issuePosts?: Array<{ id: string; title: string; location: string; image?: string; createdAt: string }>;
    };
    reviews?: Array<{
        id: string;
        action: ReviewStatus;
        reason: string;
        createdAt: string;
        reviewer: { id: string; name: string; role: string };
    }>;
    issuePost?: {
        id: string;
        title: string;
        description: string;
        category: string;
        location: string;
        image: string;
        createdAt: string;
        status: string;
        reportedBy?: { id: string; name: string };
    };
}

export interface ApiTimelineEvent {
    id: string;
    issuePostId?: string | null;
    consolidatedTicketId?: string | null;
    eventType: string;
    title: string;
    description: string;
    source: TimelineSource;
    metadata?: any;
    createdAt: string;
}

export interface ApiAdminMetrics {
    totalReports: number;
    reportsToday: number;
    openReports: number;
    awaitingAiAnalysis: number;
    awaitingHumanReview: number;
    confirmedIncidentGroups: number;
    relatedIncidentGroups: number;
    resolvedReports: number;
    highPriorityIncidents: number;
    totalAssessments: number;
}

export interface ApiAdminReportItem {
    id: string;
    title: string;
    description: string;
    category: string;
    location: string;
    lat: number;
    lng: number;
    status: string;
    image: string;
    reporters: number;
    createdAt: string;
    reportedBy?: { id: string; name: string; role: string };
    consolidatedTicket?: {
        id: string;
        status: string;
        escalationFlag: boolean;
        department?: { id: string; name: string };
    } | null;
    assessments: Array<{
        id: string;
        decision: string;
        confidence: number;
        explanation: string;
        model: string;
        requiresReview: boolean;
        reviewStatus: string;
        createdAt: string;
    }>;
}

export const civicLens = {
    getAdminMetrics: (params?: Record<string, string>) => {
        const qs = params ? "?" + new URLSearchParams(params).toString() : "";
        return request<{ metrics: ApiAdminMetrics }>(`/civiclens/admin-metrics${qs}`);
    },

    getAdminReports: (params?: Record<string, string>) => {
        const qs = params ? "?" + new URLSearchParams(params).toString() : "";
        return request<{
            reports: ApiAdminReportItem[];
            pagination: { total: number; page: number; limit: number; totalPages: number };
        }>(`/civiclens/reports${qs}`);
    },

    getInvestigateIncident: (issuePostId: string) =>
        request<{
            report: any;
            candidates: any[];
            timeline: ApiTimelineEvent[];
            latestAssessment: ApiIncidentAssessment | null;
        }>(`/civiclens/investigate/${issuePostId}`),

    getReviewQueue: (params?: {
        status?: string;
        category?: string;
        decision?: string;
        priority?: string;
        q?: string;
        sort?: string;
        page?: number | string;
        limit?: number | string;
        cityName?: string;
        cityId?: string;
    }) => {
        const qs = params ? "?" + new URLSearchParams(params as Record<string, string>).toString() : "";
        return request<{
            queue: ApiIncidentAssessment[];
            totalCount: number;
            pagination: { page: number; limit: number; totalPages: number; total: number };
            metrics: {
                pendingReviewItems: number;
                highPriorityReviews: number;
                conflictingEvidenceReviews: number;
                completedToday: number;
                avgTurnaroundMinutes: number | null;
            };
        }>(`/civiclens/review-queue${qs}`);
    },

    getIssueAssessment: (issuePostId: string) =>
        request<{
            assessments: ApiIncidentAssessment[];
            timeline: ApiTimelineEvent[];
            latestAssessment: ApiIncidentAssessment | null;
        }>(`/civiclens/assessments/${issuePostId}`),

    submitReview: (
        assessmentId: string,
        data: {
            action: ReviewStatus | "CONFIRM_SAME" | "KEEP_SEPARATE" | "MARK_RELATED" | "CREATE_NEW_INCIDENT" | "REQUEST_MORE_INFO" | "DEFER";
            reason: string;
            targetTicketId?: string;
        }
    ) =>
        request<{ message: string; review: any; finalTicketId?: string }>(`/civiclens/review/${assessmentId}`, {
            method: "POST",
            body: JSON.stringify(data),
        }),

    triggerReanalysis: (issuePostId: string) =>
        request<{ message: string; assessment: any }>(`/civiclens/analyze/${issuePostId}`, {
            method: "POST",
        }),

    getDomainClusters: (params?: Record<string, string>) => {
        const qs = params ? "?" + new URLSearchParams(params).toString() : "";
        return request<{
            cityName: string;
            cityId: string;
            totalIssues: number;
            clusters: Array<{
                clusterId: string;
                domain: string;
                subArea: string;
                reportCount: number;
                reports: Array<{
                    id: string;
                    title: string;
                    description: string;
                    category: string;
                    location: string;
                    lat: number;
                    lng: number;
                    imageUrl?: string;
                    createdAt: string;
                }>;
                synthesizedRootCause: {
                    domainClassification: string;
                    coreRootCauseTitle: string;
                    detailedRootCauseExplanation: string;
                    singleRemedialAction: string;
                    targetDepartment: string;
                    confidence: number;
                    urgency: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
                    impactSummary: string;
                    linkedReportIds: string[];
                };
            }>;
        }>(`/civiclens/domain-clusters${qs}`);
    },
};


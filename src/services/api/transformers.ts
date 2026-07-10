// ══════════════════════════════════════════════════════════════
// DATA TRANSFORMERS - Backend ↔ Frontend
// Backend uses English field names now
// ══════════════════════════════════════════════════════════════

// ── User Transformers ──

export interface BackendUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  position?: string;
  department?: string;
  status: 'active' | 'inactive';
  platformRole: 'admin' | 'user';
  login: string;
  createdAt: string;
}

export interface FrontendUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  position?: string;
  department?: string;
  status: 'active' | 'inactive';
  platformRole: 'admin' | 'user';
  login: string;
  createdAt: string;
}

export const transformUserFromBackend = (user: BackendUser): FrontendUser => ({
  id: user.id,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  phone: user.phone,
  position: user.position,
  department: user.department,
  status: user.status,
  platformRole: user.platformRole,
  login: user.login,
  createdAt: user.createdAt,
});

export const transformUserToBackend = (user: Partial<FrontendUser>): Partial<BackendUser> => {
  // Since backend and frontend now use the same field names, just return as is
  return user as Partial<BackendUser>;
};

// ── Auth Transformers ──

export interface BackendLoginResponse {
  accessToken: string;
  user: BackendUser;
}

export interface FrontendLoginResponse {
  accessToken: string;
  user: FrontendUser;
}

export const transformLoginResponse = (response: BackendLoginResponse): FrontendLoginResponse => ({
  accessToken: response.accessToken,
  user: transformUserFromBackend(response.user),
});

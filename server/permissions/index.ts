export {
  PERMISSIONS,
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
  getPermissionsForRole,
  type Permission,
} from "./permissions";

export {
  requireRole,
  isSchoolMember,
  getSchoolMember,
  isClassMember,
  getClassMember,
  isParentOf,
  isClassTeacher,
  requireUserByClerkId,
} from "./context";

"use client";

/**
 * §5.16 — Paginated users table with role filter + search + role change
 * dropdown.
 *
 * Fetches via `listUsersAction` and opens the UserDetailSheet on row click.
 */

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Users } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { PageLoader } from "@/components/shared/loading";
import {
  AdminTableFilters,
  type FilterOption,
} from "@/components/admin/admin-table-filters";
import { AdminTablePagination } from "@/components/admin/admin-table-pagination";
import { UserDetailSheet } from "@/components/admin/user-detail-sheet";
import { listUsersAction, updateUserRoleAction } from "@/server/actions/admin";
import { USER_ROLES } from "@/types";
import { roleBadgeVariant } from "@/lib/role-utils";
import type { AdminUserRow, Paginated } from "@/server/services/admin";

const PAGE_SIZE = 10;

export function UsersTable() {
  const t = useTranslations("Admin");
  const tRoles = useTranslations("Roles");

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Paginated<AdminUserRow> | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listUsersAction({
        search: search.trim() || undefined,
        role: (roleFilter || undefined) as never,
        page,
        pageSize: PAGE_SIZE,
      });
      if (res.success) setData(res.data);
      else toast.error(res.error?.message ?? t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, page, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Debounce search by 300ms.
  useEffect(() => {
    const id = setTimeout(() => {
      if (page !== 1) setPage(1);
      else fetchData();
    }, 300);
    return () => clearTimeout(id);
     
  }, [search]);

  useEffect(() => {
    if (page !== 1) setPage(1);
    else fetchData();
     
  }, [roleFilter]);

  const roleOptions: FilterOption[] = USER_ROLES.map((r) => ({
    value: r,
    label: tRoles(r),
  }));

  async function handleQuickRoleChange(userId: string, role: string) {
    const res = await updateUserRoleAction({ userId, role: role as never });
    if (res.success) {
      toast.success(t("roleChanged"));
      fetchData();
    } else {
      toast.error(res.error?.message ?? t("changeRoleFailed"));
    }
  }

  function openDetail(userId: string) {
    setSelectedUserId(userId);
    setSheetOpen(true);
  }

  return (
    <div className="space-y-4">
      <AdminTableFilters
        search={search}
        onSearchChange={setSearch}
        filterValue={roleFilter}
        onFilterChange={setRoleFilter}
        filterOptions={roleOptions}
        filterAllLabel={t("allRoles")}
        loading={loading}
      />

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("user")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("role")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("joinedAt")}</TableHead>
                <TableHead className="hidden lg:table-cell">{t("lastActive")}</TableHead>
                <TableHead className="text-right">{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && !data ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    <PageLoader />
                  </TableCell>
                </TableRow>
              ) : !data || data.items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10">
                    <EmptyState
                      icon={Users}
                      title={t("noUsers")}
                      description={t("noUsersHint")}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                data.items.map((u) => {
                  const fullName =
                    [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email;
                  const initials =
                    (u.firstName?.[0] ?? "") + (u.lastName?.[0] ?? "");
                  return (
                    <TableRow
                      key={u.id}
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() => openDetail(u.id)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="size-9">
                            {u.avatarUrl && (
                              <AvatarImage src={u.avatarUrl} alt={fullName} />
                            )}
                            <AvatarFallback>
                              {initials || "?"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{fullName}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {u.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant={roleBadgeVariant(u.role)}>
                          {tRoles(u.role)}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell whitespace-nowrap text-sm text-muted-foreground">
                        {new Date(u.createdAt).toLocaleDateString("fr-FR")}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell whitespace-nowrap text-sm text-muted-foreground">
                        {u.lastActiveAt
                          ? new Date(u.lastActiveAt).toLocaleDateString("fr-FR")
                          : "—"}
                      </TableCell>
                      <TableCell
                        className="text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" aria-label={t("changeRole")}>
                              {t("changeRole")}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuLabel>
                              {t("changeRole")}
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {USER_ROLES.map((r) => (
                              <DropdownMenuItem
                                key={r}
                                onClick={() => handleQuickRoleChange(u.id, r)}
                                disabled={r === u.role}
                              >
                                {tRoles(r)}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {data && (
          <AdminTablePagination
            page={page}
            pageSize={PAGE_SIZE}
            total={data.total}
            loading={loading}
            onPageChange={setPage}
          />
        )}
      </div>

      <UserDetailSheet
        userId={selectedUserId}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </div>
  );
}

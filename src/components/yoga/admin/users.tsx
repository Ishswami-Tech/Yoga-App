"use client";
import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch, apiDelete, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Users,
  GraduationCap,
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  ShieldCheck,
  ShieldBan,
  UserCog,
  RefreshCw,
  Eye,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import {
  PageHeader,
  RoleBadge,
  StatusBadge,
  ErrorCard,
  EmptyState,
  Spinner,
  istDate,
} from "./shared";
import { UserDetailDrawer } from "./user-detail-drawer";

type AdminUser = {
  id: string;
  email: string;
  name: string;
  role: "STUDENT" | "INSTRUCTOR" | "ADMIN";
  status: "ACTIVE" | "DISABLED";
  phone: string | null;
  whatsappNumber: string | null;
  createdAt: string;
  membershipStatus: "ACTIVE" | "NONE";
  membershipEnd: string | null;
};

type ListResp = { items: AdminUser[] };

export function UsersView({
  role,
  title,
  description,
  singularLabel,
  icon,
}: {
  role: "STUDENT" | "INSTRUCTOR";
  title: string;
  description: string;
  singularLabel: string;
  icon: React.ReactNode;
}) {
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [deletingId, setDeletingId] = useState<AdminUser | null>(null);
  const [addKey, setAddKey] = useState(0);
  const [detailId, setDetailId] = useState<string | null>(null);

  // Debounce search.
  const onSearch = (val: string) => {
    setQ(val);
    if (window) {
      window.clearTimeout((onSearch as any)._t);
      (onSearch as any)._t = window.setTimeout(
        () => setDebouncedQ(val.trim()),
        300
      );
    }
  };

  const queryKey = ["admin", "users", role, debouncedQ];
  const list = useQuery<ListResp>({
    queryKey,
    queryFn: () =>
      apiGet<ListResp>(
        `/api/admin/users?role=${role}${
          debouncedQ ? `&q=${encodeURIComponent(debouncedQ)}` : ""
        }`
      ),
    refetchInterval: 60 * 1000,
  });
  const qc = useQueryClient();

  const createMut = useMutation({
    mutationFn: (body: {
      name: string;
      email: string;
      password: string;
      role: "STUDENT" | "INSTRUCTOR" | "ADMIN";
      phone?: string;
      whatsappNumber?: string;
    }) => apiPost("/api/admin/users", body),
    onSuccess: () => {
      toast.success(`${singularLabel} created`, {
        description: "Account is now active.",
      });
      setAddOpen(false);
      qc.invalidateQueries({ queryKey: ["admin", "users", role] });
      qc.invalidateQueries({ queryKey: ["admin", "dashboard"] });
    },
    onError: (e: ApiError) =>
      toast.error("Couldn't create user", { description: e.message }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      apiPatch(`/api/admin/users/${id}`, body),
    onSuccess: () => {
      toast.success(`${singularLabel} updated`);
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["admin", "users", role] });
      qc.invalidateQueries({ queryKey: ["admin", "dashboard"] });
    },
    onError: (e: ApiError) =>
      toast.error("Couldn't update user", { description: e.message }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiDelete(`/api/admin/users/${id}`),
    onSuccess: () => {
      toast.success(`${singularLabel} deleted`);
      setDeletingId(null);
      qc.invalidateQueries({ queryKey: ["admin", "users", role] });
      qc.invalidateQueries({ queryKey: ["admin", "dashboard"] });
    },
    onError: (e: ApiError) =>
      toast.error("Couldn't delete user", { description: e.message }),
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title={title}
        description={description}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                qc.invalidateQueries({ queryKey: ["admin", "users", role] })
              }
            >
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
            {role === "STUDENT" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  window.open("/api/admin/students/export", "_blank", "noopener,noreferrer");
                  toast.success("Downloading students CSV");
                }}
              >
                <Download className="h-4 w-4" /> Export CSV
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => {
                setAddKey((k) => k + 1);
                setAddOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> Add {singularLabel.toLowerCase()}
            </Button>
          </>
        }
      />

      <Card>
        <CardContent className="p-3 md:p-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder={`Search ${singularLabel.toLowerCase()}s by name, email, phone…`}
                value={q}
                onChange={(e) => onSearch(e.target.value)}
              />
            </div>
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
              {icon}
              {list.data?.items.length ?? 0} of 200 max
            </div>
          </div>
        </CardContent>
      </Card>

      {list.isLoading ? (
        <Card>
          <CardContent className="p-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : list.isError ? (
        <ErrorCard
          message={(list.error as ApiError)?.message ?? "Couldn't load users."}
          onRetry={() => qc.invalidateQueries({ queryKey })}
        />
      ) : (list.data?.items.length ?? 0) === 0 ? (
        <EmptyState
          icon={role === "INSTRUCTOR" ? GraduationCap : Users}
          title={
            debouncedQ
              ? `No ${role.toLowerCase()}s match your search`
              : `No ${role.toLowerCase()}s yet`
          }
          description={
            debouncedQ
              ? "Try a different name, email, or phone number."
              : `Add your first ${singularLabel.toLowerCase()} to start scheduling classes${
                  role === "INSTRUCTOR" ? " and assigning schedules" : ""
                }.`
          }
          action={
            !debouncedQ ? (
              <Button
                size="sm"
                onClick={() => {
                  setAddKey((k) => k + 1);
                  setAddOpen(true);
                }}
              >
                <Plus className="h-4 w-4" /> Add {singularLabel.toLowerCase()}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="hidden md:table-cell">Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden lg:table-cell">WhatsApp</TableHead>
                {role === "STUDENT" && (
                  <TableHead className="hidden md:table-cell">
                    Membership
                  </TableHead>
                )}
                <TableHead className="hidden lg:table-cell">Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.data!.items.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{u.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {u.email}
                      </span>
                      {u.phone && (
                        <span className="text-[11px] text-muted-foreground">
                          📞 {u.phone}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <RoleBadge role={u.role} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={u.status} />
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {u.whatsappNumber ? (
                      <span className="text-sm">{u.whatsappNumber}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  {role === "STUDENT" && (
                    <TableCell className="hidden md:table-cell">
                      <div className="flex flex-col gap-1">
                        <StatusBadge status={u.membershipStatus} />
                        {u.membershipEnd && (
                          <span className="text-[11px] text-muted-foreground">
                            until {istDate(u.membershipEnd)}
                          </span>
                        )}
                      </div>
                    </TableCell>
                  )}
                  <TableCell className="hidden lg:table-cell">
                    <span className="text-sm text-muted-foreground">
                      {istDate(u.createdAt)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="User actions"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuLabel>
                          <div className="flex flex-col">
                            <span className="font-medium truncate">
                              {u.name}
                            </span>
                            <span className="text-xs text-muted-foreground truncate">
                              {u.email}
                            </span>
                          </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setDetailId(u.id)}>
                          <Eye className="h-4 w-4" /> View details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setEditing(u)}>
                          <Pencil className="h-4 w-4" /> Edit profile
                        </DropdownMenuItem>
                        <DropdownMenuItem disabled>
                          <UserCog className="h-4 w-4" /> Role: {u.role}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {u.status === "ACTIVE" ? (
                          <DropdownMenuItem
                            onClick={() =>
                              updateMut.mutate({
                                id: u.id,
                                body: { status: "DISABLED" },
                              })
                            }
                          >
                            <ShieldBan className="h-4 w-4" /> Disable account
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onClick={() =>
                              updateMut.mutate({
                                id: u.id,
                                body: { status: "ACTIVE" },
                              })
                            }
                          >
                            <ShieldCheck className="h-4 w-4" /> Reactivate
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setDeletingId(u)}
                        >
                          <Trash2 className="h-4 w-4" /> Delete user
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Keyed create dialog: bumping addKey on each open remounts the form
          so fields start clean even after a previous successful submit. */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add new user</DialogTitle>
            <DialogDescription>
              Provision a new account. The user will sign in with this email
              and password.
            </DialogDescription>
          </DialogHeader>
          <CreateUserForm
            key={addKey}
            defaultRole={role}
            isPending={createMut.isPending}
            onSubmit={(body) => createMut.mutate(body)}
            onCancel={() => setAddOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit dialog keyed by user id so opening a different user remounts
          the form with fresh initial values. */}
      <Dialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {editing?.name ?? "user"}</DialogTitle>
            <DialogDescription>
              Update role, status, or contact details. Users manage their own
              passwords.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <EditUserForm
              key={editing.id}
              user={editing}
              isPending={updateMut.isPending}
              onSubmit={(body) =>
                updateMut.mutate({ id: editing.id, body })
              }
              onCancel={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deletingId}
        onOpenChange={(o) => !o && setDeletingId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {deletingId?.name ?? "user"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the account and all related data
              (sessions, payments, WhatsApp messages). This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={deleteMut.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (deletingId) deleteMut.mutate(deletingId.id);
              }}
            >
              {deleteMut.isPending ? <Spinner /> : <Trash2 className="h-4 w-4" />}
              Delete forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* User detail drawer */}
      <UserDetailDrawer
        userId={detailId}
        open={!!detailId}
        onOpenChange={(o) => !o && setDetailId(null)}
      />
    </div>
  );
}

// --- Create form ---------------------------------------------------------

function CreateUserForm({
  defaultRole,
  isPending,
  onSubmit,
  onCancel,
}: {
  defaultRole: "STUDENT" | "INSTRUCTOR";
  isPending: boolean;
  onSubmit: (body: {
    name: string;
    email: string;
    password: string;
    role: "STUDENT" | "INSTRUCTOR" | "ADMIN";
    phone?: string;
    whatsappNumber?: string;
  }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"STUDENT" | "INSTRUCTOR" | "ADMIN">(
    defaultRole
  );
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");

  const valid =
    name.trim().length >= 2 &&
    /\S+@\S+\.\S+/.test(email) &&
    password.length >= 6;

  return (
    <>
      <div className="space-y-3">
        <Field label="Full name">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Priya Sharma"
            autoFocus
          />
        </Field>
        <Field label="Email">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="priya@yoga.demo"
          />
        </Field>
        <Field label="Password" hint="Min 6 characters">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </Field>
        <Field label="Role">
          <Select
            value={role}
            onValueChange={(v) =>
              setRole(v as "STUDENT" | "INSTRUCTOR" | "ADMIN")
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="STUDENT">Student</SelectItem>
              <SelectItem value="INSTRUCTOR">Instructor</SelectItem>
              <SelectItem value="ADMIN">Admin</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone (optional)">
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
            />
          </Field>
          <Field label="WhatsApp (optional)">
            <Input
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="+91 98765 43210"
            />
          </Field>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          disabled={!valid || isPending}
          onClick={() =>
            onSubmit({
              name: name.trim(),
              email: email.trim(),
              password,
              role,
              phone: phone.trim() || undefined,
              whatsappNumber: whatsapp.trim() || undefined,
            })
          }
        >
          {isPending ? <Spinner /> : <Plus className="h-4 w-4" />}
          Create user
        </Button>
      </DialogFooter>
    </>
  );
}

// --- Edit form -----------------------------------------------------------

function EditUserForm({
  user,
  isPending,
  onSubmit,
  onCancel,
}: {
  user: AdminUser;
  isPending: boolean;
  onSubmit: (body: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState<"STUDENT" | "INSTRUCTOR" | "ADMIN">(
    user.role
  );
  const [status, setStatus] = useState<"ACTIVE" | "DISABLED">(user.status);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [whatsapp, setWhatsapp] = useState(user.whatsappNumber ?? "");

  return (
    <>
      <div className="space-y-3">
        <Field label="Full name">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Email">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Role">
            <Select
              value={role}
              onValueChange={(v) =>
                setRole(v as "STUDENT" | "INSTRUCTOR" | "ADMIN")
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="STUDENT">Student</SelectItem>
                <SelectItem value="INSTRUCTOR">Instructor</SelectItem>
                <SelectItem value="ADMIN">Admin</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Status">
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as "ACTIVE" | "DISABLED")}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="DISABLED">Disabled</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <Field label="WhatsApp">
            <Input
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
            />
          </Field>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          disabled={isPending}
          onClick={() =>
            onSubmit({
              name: name.trim(),
              email: email.trim(),
              role,
              status,
              phone: phone.trim() || null,
              whatsappNumber: whatsapp.trim() || null,
            })
          }
        >
          {isPending ? <Spinner /> : <Pencil className="h-4 w-4" />}
          Save changes
        </Button>
      </DialogFooter>
    </>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        {hint && (
          <span className="text-[10px] text-muted-foreground">{hint}</span>
        )}
      </div>
      {children}
    </div>
  );
}

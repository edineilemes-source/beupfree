import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { NEON } from "@/lib/brand";

type Mode = "login" | "register";
type FieldName = "name" | "email" | "password" | "confirmPassword";
type FieldErrors = Partial<Record<FieldName, string>>;

const emailSchema = z.string().trim().min(1, "Informe seu e-mail.").email("Informe um e-mail válido.");
const passwordSchema = z.string().min(8, "A senha deve ter no mínimo 8 caracteres.").max(128, "A senha deve ter no máximo 128 caracteres.");

export type AuthDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialMode?: Mode;
};

export default function AuthDialog({ open, onOpenChange, initialMode = "login" }: AuthDialogProps) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setMode(initialMode);
    } else {
      setMode(initialMode);
      setName("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setErrors({});
      setSubmitError("");
      setIsSubmitting(false);
    }
  }, [open, initialMode]);

  const switchMode = (nextMode: Mode) => {
    setMode(nextMode);
    setErrors({});
    setSubmitError("");
    setPassword("");
    setConfirmPassword("");
  };

  const validate = () => {
    const nextErrors: FieldErrors = {};
    if (mode === "register" && !name.trim()) nextErrors.name = "Informe seu nome.";
    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success) nextErrors.email = emailResult.error.issues[0]?.message;
    const passwordResult = passwordSchema.safeParse(password);
    if (!passwordResult.success) nextErrors.password = passwordResult.error.issues[0]?.message;
    if (mode === "register" && confirmPassword !== password) {
      nextErrors.confirmPassword = "As senhas devem ser iguais.";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError("");
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      if (mode === "register") {
        await register({ name: name.trim(), email: email.trim(), password });
      } else {
        await login({ email: email.trim(), password });
      }
      onOpenChange(false);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Não foi possível continuar.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const field = (id: FieldName, label: string, props: React.ComponentProps<typeof Input>) => (
    <div className="space-y-2">
      <Label htmlFor={`auth-${id}`}>{label}</Label>
      <Input
        id={`auth-${id}`}
        aria-invalid={Boolean(errors[id])}
        aria-describedby={errors[id] ? `auth-${id}-error` : undefined}
        {...props}
      />
      {errors[id] && <p id={`auth-${id}-error`} className="text-sm text-destructive">{errors[id]}</p>}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] overflow-y-auto sm:max-w-md" data-testid="auth-dialog">
        <DialogHeader>
          <DialogTitle>{mode === "login" ? "Entrar no UpPulse" : "Criar conta"}</DialogTitle>
          <DialogDescription>
            {mode === "login" ? "Acesse sua conta para continuar." : "Cadastre-se para acessar o UpPulse."}
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit} noValidate>
          {mode === "register" && field("name", "Nome", {
            value: name,
            onChange: (event) => setName(event.target.value),
            autoComplete: "name",
            autoFocus: true,
            required: true,
          })}
          {field("email", "E-mail", {
            type: "email",
            value: email,
            onChange: (event) => setEmail(event.target.value),
            autoComplete: "email",
            autoFocus: mode === "login",
            required: true,
          })}
          {field("password", "Senha", {
            type: "password",
            value: password,
            onChange: (event) => setPassword(event.target.value),
            autoComplete: mode === "login" ? "current-password" : "new-password",
            minLength: 8,
            maxLength: 128,
            required: true,
          })}
          {mode === "register" && field("confirmPassword", "Confirmar senha", {
            type: "password",
            value: confirmPassword,
            onChange: (event) => setConfirmPassword(event.target.value),
            autoComplete: "new-password",
            minLength: 8,
            maxLength: 128,
            required: true,
          })}
          {submitError && <p role="alert" className="text-sm font-medium text-destructive">{submitError}</p>}
          <Button
            type="submit"
            className="w-full text-black"
            style={{ backgroundColor: NEON }}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            {mode === "login" ? "Ainda não tem conta?" : "Já tem conta?"}{" "}
            <button
              type="button"
              className="font-semibold underline underline-offset-4"
              onClick={() => switchMode(mode === "login" ? "register" : "login")}
            >
              {mode === "login" ? "Criar conta" : "Entrar"}
            </button>
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import z from "zod";

const PatientRegistrationZSchema = z.object({
    name: z
        .string("Not A String!!")
        .min(3, "Name must contain atleast 3 Characters!")
        .max(20),
    email: z.email(),
    password: z
        .string()
        .min(8, "Password must be at least 8 characters")
        .regex(/[A-Z]/, "Add at least one uppercase letter")
        .regex(/[a-z]/, "Add at least one lowercase letter")
        .regex(/[0-9]/, "Add at least one number"),
    patient: z
        .object({
            contactNumber: z.string().optional(),
        })
        .optional(),
});

const LoginZSchema = z.object({
    email: z.email(),
    password: z
        .string()
        .min(8, "Password must be at least 8 characters")
        .regex(/[A-Z]/, "Add at least one uppercase letter")
        .regex(/[a-z]/, "Add at least one lowercase letter")
        .regex(/[0-9]/, "Add at least one number"),
});

const ForgetPasswordZSchema = z.object({
    email: z.email(),
});
const ResetPasswordZSchema = z.object({
    email: z.email(),
    otp: z.string().length(6),
    newPassword: z
        .string()
        .min(8, "Password must be at least 8 characters")
        .regex(/[A-Z]/, "Add at least one uppercase letter")
        .regex(/[a-z]/, "Add at least one lowercase letter")
        .regex(/[0-9]/, "Add at least one number"),
});

const PatientEmailVerifyZSchema = z.object({
    email: z.email(),
    otp: z.string().length(6),
});

export const UserValidation = {
    PatientRegistrationZSchema,
    LoginZSchema,
    ForgetPasswordZSchema,
    ResetPasswordZSchema,
    PatientEmailVerifyZSchema,
};

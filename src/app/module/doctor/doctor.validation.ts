import { z } from "zod";

export const ApplyAsDoctorZSchema = z.object({
	user: z.object({
		name: z
			.string({
				message: "Name is required",
			})
			.min(2, "Name must be at least 2 characters"),

		email: z.email({
			message: "Invalid email address",
		}),
	}),

	doctor: z.object({
		address: z.string().optional(),

		specilization: z
			.string({
				message: "Specialization is required",
			})
			.min(1, "Specialization cannot be empty"),

		licenseNumber: z
			.string({
				message: "License number is required",
			})
			.min(1, "License number cannot be empty"),

		qualifications: z
			.string({
				message: "Qualifications are required",
			})
			.min(1, "Qualifications cannot be empty"),

		// Coerce string to number for FormData inputs
		experienceYears: z.coerce
			.number({
				message: "Experience years must be a valid number",
			})
			.int("Experience must be an integer")
			.nonnegative("Experience cannot be negative"),

		bio: z.string().optional(),

		// Coerce string to number for FormData inputs
		consultationFee: z.coerce
			.number({
				message: "Consultation fee must be a valid number",
			})
			.positive("Consultation fee must be a positive number")
			.optional(),

		contactNumber: z.string().optional(),
	}),
});

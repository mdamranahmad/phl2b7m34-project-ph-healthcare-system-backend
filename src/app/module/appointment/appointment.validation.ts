import z from "zod";

export const BookAppointmentValidateZSchema = z.object({
	scheduleId: z.string().min(1, "Schedule Id Is Required!"),
});

export const UpdateAppointmentStatusValidateZSchema = z.object({
	status: z.enum(
		["ONGOING", "COMPLETED"],
		"Status Must Be Either ONGOING or COMPLETED!",
	),
});

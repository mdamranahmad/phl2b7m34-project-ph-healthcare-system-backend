import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { AppointmentService } from "./appointment.service";

const bookAppointment = catchAsync(async (req: Request, res: Response) => {
	const payload = req.body;
	const user = req.user!;

	const result = await AppointmentService.bookAppointment(payload, user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Payment Process for Appointment Initiated Successfully.",
		data: result,
	});
});

const payAppointment = catchAsync(async (req: Request, res: Response) => {
	const payload = req.body;
	const user = req.user!;

	const result = await AppointmentService.payAppointment(payload, user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Payment Process for Unpaid Appointment Initiated Successfully.",
		data: result,
	});
});

const cancelAppointment = catchAsync(async (req: Request, res: Response) => {
	const payload = req.body;
	// const user = req.user!;

	const result = await AppointmentService.cancelAppointment(payload);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Appointment Cancelled and Refunded Successfully.",
		data: result,
	});
});

const bookAppointmentCallback = catchAsync(
	async (req: Request, res: Response) => {
		console.log("req.query: ", req.query);
		const { redirectUrl } = await AppointmentService.bookAppointmentCallback(
			req.query,
		);

		res.redirect(redirectUrl);

		// sendResponse(res, {
		//     statusCode: httpStatus.OK,
		//     success: true,
		//     message: "Profile picture updated successfully.",
		//     data: result,
		// });
	},
);

export const AppointmentController = {
	bookAppointment,
	bookAppointmentCallback,
	payAppointment,
	cancelAppointment,
};

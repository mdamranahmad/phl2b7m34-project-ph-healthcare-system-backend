import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { PrescriptionServices } from "./prescription.service";

const createPrescription = catchAsync(async (req: Request, res: Response) => {
	const payload = req.body;

	// biome-ignore lint/style/noNonNullAssertion: explanation>
	const user = req.user!;

	const result = await PrescriptionServices.createPrescription(payload, user);

	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: "Prescription Created And Emailed To Patient Successfully!",
		data: result,
	});
});

const getSinglePrescription = catchAsync(
	async (req: Request, res: Response) => {
		const appointmentId = req.params.appointmentId as string;

		// biome-ignore lint/style/noNonNullAssertion: explanation>
		const user = req.user!;

		const result = await PrescriptionServices.getSinglePrescription(
			appointmentId,
			user,
		);

		sendResponse(res, {
			success: true,
			statusCode: httpStatus.OK,
			message: "Prescription Retrieved Successfully!",
			data: result,
		});
	},
);

export const PrescriptionController = {
	createPrescription,
	getSinglePrescription,
};

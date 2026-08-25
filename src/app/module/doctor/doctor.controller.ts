import type { Request, Response } from "express";
import httpStatus from "http-status";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { DoctorServices } from "./doctor.service";
import { ApplyAsDoctorZSchema } from "./doctor.validation";

const applyAsDoctor = catchAsync(async (req: Request, res: Response) => {
	const files = req.files as { [fieldName: string]: Express.Multer.File[] };

	const resume = files?.["resume"]?.[0];
	const additionalFiles = files?.["additionalFiles"];

	// console.log("req.body.data: ",JSON.parse(req.body.data))

	const zodValidationResult = ApplyAsDoctorZSchema.safeParse(
		JSON.parse(req.body.data),
	);

	if (!zodValidationResult.success) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			zodValidationResult.error.issues[0].message,
		);
	}

	const payload = zodValidationResult.data;

	const result = await DoctorServices.applyAsDoctor(
		payload,
		resume,
		additionalFiles,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Appllied As Doctor Successfully!",
		data: result,
	});
});

const verifyDoctorEmail = catchAsync(async (req: Request, res: Response) => {
	const payload = req.body;

	const result = await DoctorServices.verifyDoctorEmail(payload);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Doctor Email Verified Successfully!",
		data: result,
	});
});

const approveDoctor = catchAsync(async (req: Request, res: Response) => {
	const payload = req.body;

	// biome-ignore lint/style/noNonNullAssertion: explanation>
	const user = req.user!;

	const result = await DoctorServices.approveDoctor(payload, user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Doctor Application Approved!",
		data: result,
	});
});

const getAllDoctors = catchAsync(async (req: Request, res: Response) => {
	const { data, meta } = await DoctorServices.getAllDoctors(req.query);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Doctors Profile Retrieved Successfully!",
		data: data,
		meta: meta,
	});
});

export const DoctorController = {
	applyAsDoctor,
	verifyDoctorEmail,
	approveDoctor,
	getAllDoctors,
};

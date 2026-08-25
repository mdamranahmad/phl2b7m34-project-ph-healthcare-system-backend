import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { UserServices } from "./user.service";
import { AppError } from "../../utils/AppError";

const uploadProfileImage = catchAsync(async (req: Request, res: Response) => {
	console.log("req.file: ", req.file);

	if (!req.file) {
		throw new AppError(httpStatus.BAD_REQUEST, "No image uploaded!");
	}

	const userId = req.user?.userId;

	const result = await UserServices.uploadProfileImage(
		req.file?.buffer,
		// biome-ignore lint/style/noNonNullAssertion: explanation>
		userId!,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Profile picture updated successfully.",
		data: result,
	});
});

export const UserController = {
	uploadProfileImage,
};

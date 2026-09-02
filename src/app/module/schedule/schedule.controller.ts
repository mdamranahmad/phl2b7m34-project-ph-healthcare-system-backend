import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { ScheduleService } from "./schedule.service";

const createSchedule = catchAsync(async (req: Request, res: Response) => {
	const payload = req.body;

	// biome-ignore lint/style/noNonNullAssertion: explanation>
	const user = req.user!;

	const result = await ScheduleService.createSchedule(payload, user);

	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: "Schedule Created Successfully!",
		data: result,
	});
});

const getMySchedules = catchAsync(async (req: Request, res: Response) => {
	// biome-ignore lint/style/noNonNullAssertion: explanation>
	const user = req.user!;

	const { data, meta } = await ScheduleService.getMySchedules(req.query, user);

	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: "Schedules Retrieved Successfully!",
		data: data,
		meta: meta,
	});
});

const getAllSchedules = catchAsync(async (req: Request, res: Response) => {
	const { data, meta } = await ScheduleService.getAllSchedules(req.query);

	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: "Schedule Retrieved Successfully!",
		data: data,
		meta: meta,
	});
});

const getScheduleById = catchAsync(async (req: Request, res: Response) => {
	const scheduleId = req.params.scheduleId as string;

	const result = await ScheduleService.getScheduleById(scheduleId);

	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: "Schedule Detailes Retrieved Successfully!",
		data: result,
	});
});

const updateSchedule = catchAsync(async (req: Request, res: Response) => {
	const scheduleId = req.params.scheduleId as string;

	const payload = req.body;

	// biome-ignore lint/style/noNonNullAssertion: explanation>
	const user = req.user!;

	const result = await ScheduleService.updateSchedule(
		scheduleId,
		payload,
		user,
	);

	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: "Schedule Updated Successfully!",
		data: result,
	});
});

const publisheSchedule = catchAsync(async (req: Request, res: Response) => {
	const scheduleId = req.params.scheduleId as string;

	// biome-ignore lint/style/noNonNullAssertion: explanation>
	const user = req.user!;

	const result = await ScheduleService.publisheSchedule(scheduleId, user);

	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: "Schedule Published Successfully!",
		data: result,
	});
});

const deleteSchedule = catchAsync(async (req: Request, res: Response) => {
	const scheduleId = req.params.scheduleId as string;

	// biome-ignore lint/style/noNonNullAssertion: explanation>
	const user = req.user!;

	const result = await ScheduleService.deleteSchedule(scheduleId, user);

	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: "Schedule Deleted Successfully!",
		data: result,
	});
});

const getTodaysSchedules = catchAsync(async (req: Request, res: Response) => {
	const { data, meta } = await ScheduleService.getTodaysSchedules(req.query);

	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: "Schedule Retrieved Successfully!",
		data: data,
		meta: meta,
	});
});

export const ScheduleController = {
	createSchedule,
	getMySchedules,
	getAllSchedules,
	getScheduleById,
	updateSchedule,
	publisheSchedule,
	deleteSchedule,
	getTodaysSchedules,
};

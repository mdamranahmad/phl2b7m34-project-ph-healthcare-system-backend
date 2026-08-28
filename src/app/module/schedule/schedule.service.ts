import { addDays, differenceInMinutes, startOfDay } from "date-fns";
import httpStatus from "http-status";
import type { ScheduleWhereInput } from "../../../generated/prisma/models";
import type { IQuery } from "../../interfaces";
import { prisma } from "../../lib/prisma";
import type { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/AppError";
import type { ICreateSchedulePayload } from "./schedule.interface";

const createSchedule = async (
	payload: ICreateSchedulePayload,
	user: RequestUser,
) => {
	const doctor = await prisma.doctor.findUnique({
		where: { userId: user.userId },
	});

	if (!doctor) {
		throw new AppError(httpStatus.NOT_FOUND, "Doctor Profile Not Found!");
	}

	const startOfTheDay = startOfDay(payload.startDateTime);
	const startOfNextDay = addDays(startOfTheDay, 1);

	const existingScheduleOnThisDate = await prisma.schedule.findFirst({
		where: {
			doctorId: doctor.id,
			isDeleted: false,
			startDateTime: {
				gte: startOfTheDay,
				lt: startOfNextDay,
			},
		},
	});

	if (!existingScheduleOnThisDate) {
		throw new AppError(
			httpStatus.CONFLICT,
			"You already have a schedule for this date!",
		);
	}

	const durationInMinutes = differenceInMinutes(
		payload.startDateTime,
		payload.endtDateTime,
	);

	const MINUTES_ALLOCATED_PER_SLOT = 20;

	const totalSlots = Math.floor(durationInMinutes / MINUTES_ALLOCATED_PER_SLOT);

	const schedule = await prisma.schedule.create({
		data: {
			startDateTime: payload.startDateTime,
			endDateTime: payload.endtDateTime,
			meetingLink: payload.meetingLink,
			totalSlots,
			availableSlots: totalSlots,
			doctorId: doctor.id,
		},
		include: {
			doctor: {
				select: {
					name: true,
					email: true,
					contactNumber: true,
				},
			},
		},
	});

	return schedule;
};

const getMySchedules = async (query: IQuery, user: RequestUser) => {
	const doctor = await prisma.doctor.findUnique({
		where: { userId: user.userId },
	});

	if (!doctor) {
		throw new AppError(httpStatus.NOT_FOUND, "Doctor Profile Not Found!");
	}

	// let limit = 10;
	// if (query.limit) {
	// 	limit = Number(query.limit);
	// }

	// let page = 1;
	// if (query.page) {
	// 	page = Number(query.page);
	// }

	// const skip = (page - 1) * limit;

	const limit = query.limit ? Number(query.limit) : 10;
	const page = query.page ? Number(query.page) : 1;
	const skip = (page - 1) * limit;
	const sortBy = query.sortBy ? query.sortBy : "createdAt";
	const sortOrder = query.sortOrder ? query.sortOrder : "desc";

	const andConditions: ScheduleWhereInput[] = [
		{
			doctorId: doctor.id,
		},
		{
			isDeleted: false,
		},
	];

	if (query.status) {
		andConditions.push({
			status: query.status,
		});
	}

	const schedules = await prisma.schedule.findMany({
		where: {
			AND: andConditions,
		},

		take: limit,
		skip,
		orderBy: {
			// startDateTime: "desc"
			[sortBy]: sortOrder,
		},
		include: {
			appointments: {
				include: {
					patient: true,
				},
			},
		},
	});

	const totalSchedules = await prisma.schedule.count({
		where: { AND: andConditions },
	});

	return {
		data: schedules,
		meta: {
			page,
			limit,
			totalSchedules,
			totalPages: Math.ceil(totalSchedules / limit),
		},
	};
};

const getAllSchedules = async (query: IQuery) => {
	const limit = query.limit ? Number(query.limit) : 10;
	const page = query.page ? Number(query.page) : 1;
	const skip = (page - 1) * limit;
	const sortBy = query.sortBy ? query.sortBy : "createdAt";
	const sortOrder = query.sortOrder ? query.sortOrder : "desc";

	const andConditions: ScheduleWhereInput[] = [];

	if (query.doctorId) {
		andConditions.push({
			doctorId: query.doctorId,
		});
	}

	if (query.email) {
		andConditions.push({
			doctor: {
				email: query.email,
			},
		});
	}

	if (query.status) {
		andConditions.push({
			status: query.status,
		});
	}

	if (query.searchTerm) {
		andConditions.push({
			doctor: {
				OR: [
					{ name: { contains: query.searchTerm, mode: "insensitive" } },
					{ email: { contains: query.searchTerm, mode: "insensitive" } },
					{
						specialization: { contains: query.searchTerm, mode: "insensitive" },
					},
				],
			},
		});
	}

	const schedules = await prisma.schedule.findMany({
		where: {
			AND: andConditions,
		},

		take: limit,
		skip,
		orderBy: {
			// startDateTime: "desc"
			[sortBy]: sortOrder,
		},
		include: {
			appointments: {
				include: {
					patient: true,
				},
			},
		},
	});

	const totalSchedules = await prisma.schedule.count({
		where: { AND: andConditions },
	});

	return {
		data: schedules,
		meta: {
			page,
			limit,
			totalSchedules,
			totalPages: Math.ceil(totalSchedules / limit),
		},
	};
};

const getSchedulesById = async (scheduleId: string) => {
	const schedule = await prisma.schedule.findUnique({
		where: {
			id: scheduleId,
		},
		include: {
			doctor: {
				select: {
					id: true,
					name: true,
					email: true,
					specialization: true,
					userId: true,
				},
			},
			appointments: {
				include: {
					patient: true,
				},
			},
		},
	});

	if (!schedule || schedule.isDeleted) {
		throw new AppError(httpStatus.NOT_FOUND, "Schedule Not Found!");
	}

	return schedule;
};

export const ScheduleService = {
	createSchedule,
	getMySchedules,
	getAllSchedules,
	getSchedulesById,
};

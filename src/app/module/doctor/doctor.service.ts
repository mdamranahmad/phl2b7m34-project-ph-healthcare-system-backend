import bcrypt from "bcryptjs";
import type { UploadApiResponse } from "cloudinary";
import crypto from "crypto";
import { addDays, startOfDay } from "date-fns";
import ejs from "ejs";
import httpStatus from "http-status";
import path from "path";
import { is, tr } from "zod/locales";
import {
    DoctorVerificationStatus,
    Role,
    ScheduleStatus,
} from "../../../generated/prisma/enums";
import type { DoctorWhereInput } from "../../../generated/prisma/models";
import config from "../../config";
import type { IQuery } from "../../interfaces";
import { cloudinary } from "../../lib/cloudinary";
import { transporter } from "../../lib/nodemailer";
import { prisma } from "../../lib/prisma";
import { redisClient } from "../../lib/redis";
import type { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/AppError";
import type {
    IApplyAsDoctorPayload,
    IApproveDoctorPayload,
    IUpdateDoctorProfilePayload,
    IVerifyDoctorEmailPayload,
} from "./doctor.interface";
import generateRandomPassword from "../../utils/randomPassword";

// const applyAsDoctor = async (
//     payload: IApplyAsDoctorPayload,
//     resume: Express.Multer.File | null,
//     additinalfiles: Express.Multer.File[],
// ) => {
//     const isUserExists = await prisma.user.findUnique({
//         where: {
//             email: payload.user.email,
//         },
//     });

//     if (isUserExists) {
//         throw new AppError(httpStatus.CONFLICT, "User Already Exists!");
//     }

//     const resumeUploadResult = await new Promise<UploadApiResponse>(
//         (resolve, reject) => {
//             cloudinary.uploader
//                 .upload_stream(
//                     {
//                         resource_type: "auto",
//                     },
//                     async (error, result) => {
//                         if (error) {
//                             return reject(error);
//                         }

//                         if (!result) {
//                             return reject(
//                                 new Error(
//                                     "No result returned from Cloudinary!",
//                                 ),
//                             );
//                         }

//                         resolve(result);
//                     },
//                 )
//                 .end(resume?.buffer);
//         },
//     );

//     const additionalFilesUploadResults = await Promise.all(
//         additinalfiles.map((file) => {
//             return new Promise<UploadApiResponse>((resolve, reject) => {
//                 cloudinary.uploader
//                     .upload_stream(
//                         { resource_type: "auto" },
//                         async (error, result) => {
//                             if (error) {
//                                 return reject(error);
//                             }

//                             if (!result) {
//                                 return reject(
//                                     new Error(
//                                         "No result returned from Cloudinary!",
//                                     ),
//                                 );
//                             }

//                             resolve(result);
//                         },
//                     )
//                     .end(file.buffer);
//             });
//         }),
//     );

//     const randomDoctorPassword = "123456Aa";

//     const hashedPassword = await bcrypt.hash(
//         randomDoctorPassword,
//         Number(config.bcrypt_salt_rounds),
//     );

//     const doctorApplication = await prisma.user.create({
//         data: {
//             ...payload.user,
//             password: hashedPassword,
//             role: Role.DOCTOR,
//             needPasswordChange: true,
//             doctor: {
//                 create: {
//                     name: payload.user.name,
//                     email: payload.user.email,
//                     ...payload.doctor,
//                     resume: resumeUploadResult.secure_url,
//                     resumePublicId: resumeUploadResult.public_id,
//                     additionalFiles: additionalFilesUploadResults.map(
//                         (file) => ({
//                             url: file.secure_url,
//                             publicId: file.public_id,
//                         }),
//                     ),
//                 },
//             },
//         },
//         include: {
//             doctor: true,
//         },
//     });

//     const expirationSeconds = 60 * 60;

//     const otpKey = `doctor-application-otp: ${payload.user.email}`;

//     const otpValue = crypto.randomInt(100000, 1000000).toString();

//     if (config.node_env === "development") {
//         console.log(`[dev] ${payload.user.email} : ${otpValue}`);
//     }

//     await redisClient.set(otpKey, otpValue, {
//         expiration: { type: "EX", value: expirationSeconds },
//     });

//     const templatePath = path.join(
//         process.cwd(),
//         "src/app/templates/registration-user-otp.ejs",
//     );

//     const templateData = {
//         name: payload.user.name,
//         email: payload.user.email,
//         OTP: otpValue,
//         expiresIn: expirationSeconds / 60,
//     };

//     const html = await ejs.renderFile(templatePath, templateData);

//     await transporter.sendMail({
//         from: config.email_sender,
//         to: payload.user.email,
//         subject: "Email Verification",
//         html,
//     });

//     return doctorApplication;
// };

// const verifyDoctorEmail = async (payload: IVerifyDoctorEmailPayload) => {
//     const email = payload.email.trim().toLowerCase();
//     const otp = payload.otp;

//     const isUserExists = await prisma.user.findUnique({
//         where: { email, role: Role.DOCTOR },
//     });

//     if (!isUserExists) {
//         throw new AppError(
//             httpStatus.NOT_FOUND,
//             "Doctor Application Not Found!",
//         );
//     }

//     if (isUserExists?.emailVerified) {
//         throw new AppError(httpStatus.BAD_REQUEST, "Email Already Varified!");
//     }

//     const otpKey = `doctor-application-otp: ${email}`;

//     const redisOTP = await redisClient.get(otpKey);

//     if (!redisOTP) {
//         throw new AppError(
//             httpStatus.BAD_REQUEST,
//             "OTP Expired. Your application window has been closed, please apply again.",
//         );
//     }

//     if (redisOTP !== otp) {
//         throw new AppError(httpStatus.UNAUTHORIZED, "OTP does not match!");
//     }

//     await redisClient.del(otpKey);

//     const verifiedDoctor = await prisma.user.update({
//         where: { id: isUserExists.id },
//         data: {
//             emailVerified: true,
//         },
//         omit: { password: true },
//         include: { doctor: true },
//     });

//     return verifiedDoctor;

//     // const patientRegistrationKey = `patient-registration-data: ${email}`;
//     // const redisPatientData = await redisClient.get(patientRegistrationKey);
//     // if (!redisPatientData) {
//     // 	throw new Error("Invalid Patient Data!");
//     // }
//     // const patientPayload: IRegisterPatientPayload = JSON.parse(redisPatientData);
//     // const createdUser = await prisma.user.create({
//     // 	data: {
//     // 		name: patientPayload.name,
//     // 		email: patientPayload.email,
//     // 		password: patientPayload.password,
//     // 		role: Role.PATIENT,
//     // 		status: UserStatus.ACTIVE,
//     // 		emailVerified: true,
//     // 		patient: {
//     // 			create: {
//     // 				name: patientPayload.name,
//     // 				email: patientPayload.email,
//     // 				contactNumber: patientPayload.patient.contactNumber || "",
//     // 			},
//     // 		},
//     // 	},
//     // 	omit: { password: true },
//     // 	include: { patient: true },
//     // });
//     // await redisClient.del(patientRegistrationKey);
//     // const templatePath = path.join(
//     // 	process.cwd(),
//     // 	"src/app/templates/patient-welcome-email.ejs",
//     // );
//     // const templateData = {
//     // 	name: createdUser.name,
//     // };
//     // const html = await ejs.renderFile(templatePath, templateData);
//     // await transporter.sendMail({
//     // 	from: config.email_sender,
//     // 	to: createdUser.email,
//     // 	subject: "Welcome to PH Healthcare System!",
//     // 	html,
//     // });
//     // const { patient, ...user } = createdUser;
//     // const jwtPayload = {
//     // 	userId: user.id,
//     // 	name: user.name,
//     // 	email: user.email,
//     // 	role: user.role,
//     // };
//     // const accessToken = jwtUtils.createToken(
//     // 	jwtPayload,
//     // 	config.jwt_access_secret,
//     // 	config.jwt_access_expires_in as SignOptions,
//     // );
//     // const refreshToken = jwtUtils.createToken(
//     // 	jwtPayload,
//     // 	config.jwt_refresh_secret,
//     // 	config.jwt_refresh_expires_in as SignOptions,
//     // );
//     // return {
//     // 	user,
//     // 	patient,
//     // 	accessToken,
//     // 	refreshToken,
//     // };

//     // if (isUserExists?.status === "BLOCKED") {
//     // 	throw new Error("User is Blocked!");
//     // }
//     // if (isUserExists?.isDeleted || isUserExists?.status === "DELETED") {
//     // 	throw new Error("User is Deleted!");
//     // }
//     // // if (isUserExists.googleId && isUserExists.authProvider === "GOOGLE") {
//     // //     throw new Error("User Has Account With Google!");
//     // // }
//     //
// };

// const approveDoctor = async (
//     payload: IApproveDoctorPayload,
//     reviewer: RequestUser,
// ) => {
//     const { doctorId, verificationStatus, rejectionReason } = payload;

//     const existingDoctor = await prisma.doctor.findUnique({
//         where: { id: doctorId },
//         include: { user: true },
//     });

//     if (!existingDoctor) {
//         throw new AppError(
//             httpStatus.NOT_FOUND,
//             "Doctor Application Not Found!",
//         );
//     }

//     if (existingDoctor.isDeleted) {
//         throw new AppError(
//             httpStatus.NOT_FOUND,
//             "Doctor Application Has Been Deleted!",
//         );
//     }

//     if (!existingDoctor.user.emailVerified) {
//         throw new AppError(
//             httpStatus.BAD_REQUEST,
//             "Doctor email has not been varified yet. Application can not be reviewed!",
//         );
//     }

//     if (
//         existingDoctor.verificationStatus !== DoctorVerificationStatus.PENDING
//     ) {
//         throw new AppError(
//             httpStatus.BAD_REQUEST,
//             `Doctor Application Has Already Been ${existingDoctor.verificationStatus.toLowerCase()}`,
//         );
//     }

//     if (
//         verificationStatus === DoctorVerificationStatus.REJECTED &&
//         !rejectionReason
//     ) {
//         throw new AppError(
//             httpStatus.BAD_REQUEST,
//             "Rejection reason is required when rejecting a doctor application.",
//         );
//     }

//     const updateDoctor = await prisma.doctor.update({
//         where: { id: doctorId },
//         data: {
//             verificationStatus,
//             rejectionReason:
//                 verificationStatus === DoctorVerificationStatus.REJECTED
//                     ? rejectionReason
//                     : null,
//             reviewedBy: reviewer.userId,
//             reviewedAt: new Date(),
//         },
//     });

//     const isApproved = verificationStatus === DoctorVerificationStatus.APPROVED;

//     const templatePath = path.join(
//         process.cwd(),
//         `src/app/templates/${isApproved ? "doctor-application-approved.ejs" : "doctor-application-rejected.ejs"}`,
//     );

//     const templateData = {
//         name: updateDoctor.name,
//         reason: updateDoctor.rejectionReason,
//     };

//     const html = await ejs.renderFile(templatePath, templateData);

//     await transporter.sendMail({
//         from: config.email_sender,
//         to: updateDoctor.email,
//         subject: isApproved
//             ? "Your Doctor Application Has Been Approved"
//             : "Your Doctor Application Has Been rejected",
//         html,
//     });

//     return updateDoctor;
// };

const applyAsDoctor = async (
    payload: IApplyAsDoctorPayload,
    resume: Express.Multer.File | null,
    additionalFiles: Express.Multer.File[],
) => {
    const isUserExists = await prisma.user.findUnique({
        where: {
            email: payload.user.email,
        },
    });

    if (isUserExists) {
        throw new AppError(
            httpStatus.CONFLICT,
            "User Already Exists With This Email",
        );
    }

    const resumeUploadResult = await new Promise<UploadApiResponse>(
        (resolve, reject) => {
            cloudinary.uploader
                .upload_stream(
                    {
                        resource_type: "auto",
                    },

                    async (error, result) => {
                        if (error) {
                            return reject(error);
                        }

                        if (!result) {
                            return reject(
                                new AppError(
                                    httpStatus.INTERNAL_SERVER_ERROR,
                                    "No result returned from Cloudinary",
                                ),
                            );
                        }

                        resolve(result);
                    },
                )
                .end(resume?.buffer);
        },
    );

    console.log({ resumeUploadResult });

    const additionalFilesUploadResults = await Promise.all(
        additionalFiles.map((file) => {
            return new Promise<UploadApiResponse>((resolve, reject) => {
                cloudinary.uploader
                    .upload_stream(
                        {
                            resource_type: "auto",
                        },

                        async (error, result) => {
                            if (error) {
                                return reject(error);
                            }

                            if (!result) {
                                return reject(
                                    new Error(
                                        "No result returned from Cloudinary",
                                    ),
                                );
                            }

                            resolve(result);
                        },
                    )
                    .end(file.buffer);
            });
        }),
    );

    console.log({ additionalFilesUploadResults });

    // const randomDoctorPassword = Math.random().toString(36).slice(-8);

    // const hashedPassword = await bcrypt.hash(
    // 	randomDoctorPassword,
    // 	Number(config.bcrypt_salt_rounds),
    // );

    const doctorApplication = await prisma.user.create({
        data: {
            ...payload.user,
            role: Role.DOCTOR,
            needPasswordChange: true,
            doctor: {
                create: {
                    name: payload.user.name,
                    email: payload.user.email,
                    ...payload.doctor,
                    resume: resumeUploadResult.secure_url,
                    resumePublicId: resumeUploadResult.public_id,
                    additionalFiles: additionalFilesUploadResults.map(
                        (file) => ({
                            url: file.secure_url,
                            publicId: file.public_id,
                        }),
                    ),
                },
            },
        },

        include: {
            doctor: true,
        },
    });

    const expirationSeconds = 60 * 60;

    const otpKey = `doctor-application-otp:${payload.user.email}`;
    const otpValue = crypto.randomInt(100000, 1000000).toString();

    if (config.node_env === "development")
        console.log(
            `[dev] Doctor application OTP for ${payload.user.email}: ${otpValue}`,
        );

    await redisClient.set(otpKey, otpValue, {
        expiration: {
            type: "EX",
            value: expirationSeconds,
        },
    });

    const tempatePath = path.join(
        process.cwd(),
        "src/app/templates/registration-user-otp.ejs",
    );

    const templateData = {
        name: payload.user.name,
        email: payload.user.email,
        OTP: otpValue,
        expiresIn: expirationSeconds / 60,
    };

    const html = await ejs.renderFile(tempatePath, templateData);

    await transporter.sendMail({
        from: config.email_sender,
        to: payload.user.email,
        subject: "Doctor Application - Email Verification",
        html,
    });

    return doctorApplication;
};

const verifyDoctorEmail = async (payload: IVerifyDoctorEmailPayload) => {
    const otp = payload.otp;
    const email = payload.email.trim().toLowerCase();

    const existingUser = await prisma.user.findUnique({
        where: { email, role: Role.DOCTOR },
    });

    if (!existingUser) {
        throw new AppError(
            httpStatus.NOT_FOUND,
            "Doctor Application Not Found. Please Apply Again.",
        );
    }

    if (existingUser.emailVerified) {
        throw new AppError(httpStatus.CONFLICT, "Email Already Verified");
    }

    const otpKey = `doctor-application-otp:${email}`;

    const redisOtp = await redisClient.get(otpKey);

    if (!redisOtp) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            "OTP Expired. Your Application Window Has Closed, Please Apply Again.",
        );
    }

    if (redisOtp !== otp) {
        throw new AppError(httpStatus.BAD_REQUEST, "OTP Does Not Match");
    }

    await redisClient.del(otpKey);

    const verifiedUser = await prisma.user.update({
        where: { id: existingUser.id },
        data: { emailVerified: true },
        omit: { password: true },
        include: { doctor: true },
    });

    return verifiedUser;
};

const approveDoctor = async (
    payload: IApproveDoctorPayload,
    reviewer: RequestUser,
) => {
    const { doctorId, verificationStatus, rejectionReason } = payload;

    const existingDoctor = await prisma.doctor.findUnique({
        where: { id: doctorId },
        include: { user: true },
    });

    if (!existingDoctor) {
        throw new AppError(
            httpStatus.NOT_FOUND,
            "Doctor Application Not Found",
        );
    }

    if (existingDoctor.isDeleted) {
        throw new AppError(
            httpStatus.GONE,
            "Doctor Application Has Been Deleted",
        );
    }

    if (!existingDoctor.user.emailVerified) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            "Doctor Has Not Verified Their Email Yet. Application Cannot Be Reviewed.",
        );
    }

    if (
        existingDoctor.verificationStatus !== DoctorVerificationStatus.PENDING
    ) {
        throw new AppError(
            httpStatus.CONFLICT,
            `Doctor Application Has Already Been ${existingDoctor.verificationStatus.toLowerCase()}`,
        );
    }

    if (
        verificationStatus === DoctorVerificationStatus.REJECTED &&
        !rejectionReason
    ) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            "Rejection Reason Is Required When Rejecting A Doctor Application",
        );
    }

    const isApproved = verificationStatus === DoctorVerificationStatus.APPROVED;

    const randomDoctorPassword = isApproved
        ? generateRandomPassword()
        : undefined;

    if (config.node_env === "development" && randomDoctorPassword) {
        console.log(
            `[dev] Random Password plain text: ${randomDoctorPassword}`,
        );
    }

    const hashedPassword = randomDoctorPassword
        ? await bcrypt.hash(
              randomDoctorPassword,
              Number(config.bcrypt_salt_rounds),
          )
        : undefined;

    const updatedDoctor = await prisma.doctor.update({
        where: { id: doctorId },
        data: {
            verificationStatus,
            rejectionReason:
                verificationStatus === DoctorVerificationStatus.REJECTED
                    ? rejectionReason
                    : null,
            reviewedBy: reviewer.userId,
            reviewedAt: new Date(),
            ...(hashedPassword
                ? { user: { update: { password: hashedPassword } } }
                : {}),
        },
    });

    const tempatePath = path.join(
        process.cwd(),
        `src/app/templates/${
            isApproved
                ? "doctor-application-approved.ejs"
                : "doctor-application-rejected.ejs"
        }`,
    );

    const templateData = {
        name: updatedDoctor.name,
        reason: updatedDoctor.rejectionReason,
        password: isApproved ? randomDoctorPassword : undefined,
    };

    const html = await ejs.renderFile(tempatePath, templateData);

    await transporter.sendMail({
        from: config.email_sender,
        to: updatedDoctor.email,
        subject: isApproved
            ? "Your Doctor Application Has Been Approved"
            : "Your Doctor Application Has Been Rejected",
        html,
    });

    return updatedDoctor;
};

const getAllDoctors = async (query: IQuery) => {
    // search, filter, sorting, pagination
    const limit = query.limit ? Number(query.limit) : 10;
    const page = query.page ? Number(query.page) : 1;
    const skip = (page - 1) * limit;
    const sortBy = query.sortBy ? query.sortBy : "createdAt";
    const sortOrder = query.sortOrder ? query.sortOrder : "desc";

    const andConditions: DoctorWhereInput[] = [];

    // Searching
    if (query.searchTerm) {
        andConditions.push({
            OR: [
                {
                    name: {
                        contains: query.searchTerm,
                        mode: "insensitive",
                    },
                },
                {
                    email: {
                        contains: query.searchTerm,
                        mode: "insensitive",
                    },
                },
                {
                    specialization: {
                        contains: query.searchTerm,
                        mode: "insensitive",
                    },
                },
                {
                    licenseNumber: {
                        contains: query.searchTerm,
                        mode: "insensitive",
                    },
                },
            ],
        });
    }

    // Filtering
    if (query.specialization) {
        andConditions.push({
            specialization: query.title,
        });
    }

    if (query.email) {
        andConditions.push({
            email: query.content,
        });
    }

    if (query.licenseNumber) {
        andConditions.push({
            licenseNumber: query.authorId,
        });
    }

    if (query.verificationStatus) {
        andConditions.push({
            verificationStatus:
                query.verificationStatus as DoctorVerificationStatus,
        });
    }

    // if (query.tags) {
    //     andConditions.push({
    //         tags: {
    //             hasSome: tagsArray,
    //         },
    //     });
    // }

    // if (query.status) {
    //     andConditions.push({
    //         status: query.status,
    //     });
    // }

    // Default Conditions
    andConditions.push({
        isDeleted: false,
    });

    // if(query.isDeleted) {
    // 	andConditions.push({
    //     isDeleted: query.isDeleted === "true" ? true : false
    // })
    // }

    const allDoctors = await prisma.doctor.findMany({
        where: { AND: andConditions.length > 0 ? andConditions : undefined },
        take: limit,
        skip: skip,

        orderBy: {
            [sortBy]: sortOrder,
        },
        include: {
            user: {
                omit: {
                    password: true,
                },
            },

            // schedules: true,
            // appointments: true,
            // prescriptions: true,
        },
    });

    const totalDoctorCount = await prisma.doctor.count({
        where: {
            AND: andConditions,
        },
    });

    return {
        data: allDoctors,
        meta: {
            page: page,
            limit: limit,
            total: totalDoctorCount,
            totalPages: Math.ceil(totalDoctorCount / limit),
        },
    };
};

const updateDoctorProfile = async (
    payload: IUpdateDoctorProfilePayload,
    user: RequestUser,
) => {
    const existingDoctor = await prisma.doctor.findUnique({
        where: { userId: user.userId },
    });

    if (!existingDoctor) {
        throw new AppError(
            httpStatus.NOT_FOUND,
            "Doctor Application Not Found!",
        );
    }

    const updatedDoctor = await prisma.doctor.update({
        where: { id: existingDoctor.id },
        data: payload,
    });

    return updatedDoctor;
};

const getAvailableDoctorsByTodaysSchedule = async (query: IQuery) => {
    // search, filter, sorting, pagination
    const limit = query.limit ? Number(query.limit) : 10;
    const page = query.page ? Number(query.page) : 1;
    const skip = (page - 1) * limit;
    const sortBy = query.sortBy ? query.sortBy : "createdAt";
    const sortOrder = query.sortOrder ? query.sortOrder : "desc";

    const now = new Date();
    const startOfToday = startOfDay(now);
    const startOfTomorrow = addDays(startOfToday, 1);

    const andConditions: DoctorWhereInput[] = [
        { isDeleted: false },
        { verificationStatus: DoctorVerificationStatus.APPROVED }, // Commented for test Purpose
        // { verificationStatus: DoctorVerificationStatus.PENDING },
        {
            shcedules: {
                some: {
                    isDeleted: false,
                    status: ScheduleStatus.PUBLISHED,
                    availableSlots: { gt: 0 },
                    startDateTime: {
                        gte: startOfToday,
                        lt: startOfTomorrow,
                        gt: now,
                    },
                },
            },
        },
    ];

    // Searching
    if (query.searchTerm) {
        andConditions.push({
            OR: [
                {
                    name: {
                        contains: query.searchTerm,
                        mode: "insensitive",
                    },
                },
                {
                    email: {
                        contains: query.searchTerm,
                        mode: "insensitive",
                    },
                },
                {
                    specialization: {
                        contains: query.searchTerm,
                        mode: "insensitive",
                    },
                },
                {
                    licenseNumber: {
                        contains: query.searchTerm,
                        mode: "insensitive",
                    },
                },
            ],
        });
    }

    // Filtering
    if (query.specialization) {
        andConditions.push({
            specialization: query.title,
        });
    }

    if (query.email) {
        andConditions.push({
            email: query.content,
        });
    }

    if (query.licenseNumber) {
        andConditions.push({
            licenseNumber: query.authorId,
        });
    }

    if (query.verificationStatus) {
        andConditions.push({
            verificationStatus:
                query.verificationStatus as DoctorVerificationStatus,
        });
    }

    andConditions.push({
        isDeleted: false,
    });

    const availableDoctors = await prisma.doctor.findMany({
        where: { AND: andConditions.length > 0 ? andConditions : undefined },
        take: limit,
        skip: skip,

        orderBy: {
            [sortBy]: sortOrder,
        },
        select: {
            id: true,
            name: true,
            specialization: true,
            licenseNumber: true,
            qualifications: true,
            experienceYears: true,
            bio: true,
            consultationFee: true,
            createdAt: true,
            shcedules: {
                where: {
                    isDeleted: false,
                    status: ScheduleStatus.PUBLISHED,
                    availableSlots: { gt: 0 },
                    startDateTime: {
                        gte: startOfToday,
                        lt: startOfTomorrow,
                        gt: now,
                    },
                },
                orderBy: { [sortBy]: sortOrder },
                select: {
                    id: true,
                    startDateTime: true,
                    endDateTime: true,
                    availableSlots: true,
                    totalSlots: true,
                },
            },
        },
    });

    const totalAvailableDoctorCount = await prisma.doctor.count({
        where: {
            AND: andConditions,
        },
    });

    return {
        data: availableDoctors,
        meta: {
            page: page,
            limit: limit,
            total: totalAvailableDoctorCount,
            totalPages: Math.ceil(totalAvailableDoctorCount / limit),
        },
    };
};

const getAllDoctorsListPublic = async (query: IQuery) => {
    // search, filter, sorting, pagination
    const limit = query.limit ? Number(query.limit) : 10;
    const page = query.page ? Number(query.page) : 1;
    const skip = (page - 1) * limit;
    const sortBy = query.sortBy ? query.sortBy : "createdAt";
    const sortOrder = query.sortOrder ? query.sortOrder : "desc";

    // const now = new Date();
    // const startOfToday = startOfDay(now);
    // const startOfTomorrow = addDays(startOfToday, 1);

    const andConditions: DoctorWhereInput[] = [
        { isDeleted: false },
        { verificationStatus: DoctorVerificationStatus.APPROVED },
        // {
        // 	shcedules: {
        // 		some: {
        // 			isDeleted: false,
        // 			status: ScheduleStatus.PUBLISHED,
        // 			availableSlots: { gt: 0 },
        // 			startDateTime: {
        // 				gte: startOfToday,
        // 				lt: startOfTomorrow,
        // 				gt: now,
        // 			},
        // 		},
        // 	},
        // },
    ];

    // Searching
    if (query.searchTerm) {
        andConditions.push({
            OR: [
                {
                    name: {
                        contains: query.searchTerm,
                        mode: "insensitive",
                    },
                },
                {
                    email: {
                        contains: query.searchTerm,
                        mode: "insensitive",
                    },
                },
                {
                    specialization: {
                        contains: query.searchTerm,
                        mode: "insensitive",
                    },
                },
                {
                    licenseNumber: {
                        contains: query.searchTerm,
                        mode: "insensitive",
                    },
                },
            ],
        });
    }

    // Filtering
    if (query.specialization) {
        andConditions.push({
            specialization: query.title,
        });
    }

    if (query.email) {
        andConditions.push({
            email: query.content,
        });
    }

    if (query.licenseNumber) {
        andConditions.push({
            licenseNumber: query.authorId,
        });
    }

    if (query.verificationStatus) {
        andConditions.push({
            verificationStatus:
                query.verificationStatus as DoctorVerificationStatus,
        });
    }

    andConditions.push({
        isDeleted: false,
    });

    const allDoctors = await prisma.doctor.findMany({
        where: { AND: andConditions.length > 0 ? andConditions : undefined },
        take: limit,
        skip: skip,

        orderBy: {
            [sortBy]: sortOrder,
        },
        select: {
            id: true,
            name: true,
            specialization: true,
            licenseNumber: true,
            qualifications: true,
            experienceYears: true,
            bio: true,
            consultationFee: true,
            createdAt: true,
            // shcedules: {
            // 	where: {
            // 		isDeleted: false,
            // 		status: ScheduleStatus.PUBLISHED,
            // 		availableSlots: { gt: 0 },
            // 		startDateTime: { gte: startOfToday, lt: startOfTomorrow, gt: now },
            // 	},
            // 	orderBy: { [sortBy]: sortOrder },
            // 	select: {
            // 		id: true,
            // 		startDateTime: true,
            // 		endDateTime: true,
            // 		availableSlots: true,
            // 		totalSlots: true,
            // 	},
            // },
        },
    });

    const totalDoctorCount = await prisma.doctor.count({
        where: {
            AND: andConditions,
        },
    });

    return {
        data: allDoctors,
        meta: {
            page: page,
            limit: limit,
            total: totalDoctorCount,
            totalPages: Math.ceil(totalDoctorCount / limit),
        },
    };
};

const getSingleDoctorPublicProfile = async (doctorId: string) => {
    const doctor = await prisma.doctor.findUnique({
        where: {
            id: doctorId,
            isDeleted: false,
            verificationStatus: DoctorVerificationStatus.APPROVED,
        },
        select: {
            id: true,
            name: true,
            specialization: true,
            licenseNumber: true,
            qualifications: true,
            experienceYears: true,
            bio: true,
            consultationFee: true,
            createdAt: true,
        },
    });

    if (!doctor) {
        throw new AppError(httpStatus.NOT_FOUND, "Doctor Not Found!");
    }

    return doctor;
};

export const DoctorServices = {
    applyAsDoctor,
    verifyDoctorEmail,
    approveDoctor,
    getAllDoctors,
    updateDoctorProfile,
    getAvailableDoctorsByTodaysSchedule,
    getAllDoctorsListPublic,
    getSingleDoctorPublicProfile,
};

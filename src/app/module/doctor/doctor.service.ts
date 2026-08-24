import bcrypt from "bcryptjs";
import type { UploadApiResponse } from "cloudinary";
import { Role } from "../../../generated/prisma/enums";
import config from "../../config";
import { cloudinary } from "../../lib/cloudinary";
import { prisma } from "../../lib/prisma";
import crypto from "crypto";
import { redisClient } from "../../lib/redis";
import path from "path";
import { transporter } from "../../lib/nodemailer";
import ejs from "ejs";

const applyAsDoctor = async (
    payload: any,
    resume: Express.Multer.File | null,
    additinalfiles: Express.Multer.File[],
) => {
    const isUserExists = await prisma.user.findUnique({
        where: {
            email: payload.user.email,
        },
    });

    if (isUserExists) {
        throw new Error("User Already Exists!");
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
                                new Error(
                                    "No result returned from Cloudinary!",
                                ),
                            );
                        }

                        resolve(result);
                    },
                )
                .end(resume?.buffer);
        },
    );

    const additionalFilesUploadResults = await Promise.all(
        additinalfiles.map((file) => {
            return new Promise<UploadApiResponse>((resolve, reject) => {
                cloudinary.uploader
                    .upload_stream(
                        { resource_type: "auto" },
                        async (error, result) => {
                            if (error) {
                                return reject(error);
                            }

                            if (!result) {
                                return reject(
                                    new Error(
                                        "No result returned from Cloudinary!",
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

    const randomDoctorPassword = "123456Aa";

    const hashedPassword = await bcrypt.hash(
        randomDoctorPassword,
        Number(config.bcrypt_salt_rounds),
    );

    const doctorApplication = await prisma.user.create({
        data: {
            ...payload.user,
            password: hashedPassword,
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

    const otpKey = `doctor-application-otp: ${payload.user.email}`;

    const otpValue = crypto.randomInt(100000, 1000000).toString();

    await redisClient.set(otpKey, otpValue, {
        expiration: { type: "EX", value: expirationSeconds },
    });

    const templatePath = path.join(
        process.cwd(),
        "src/app/templates/registration-user-otp.ejs",
    );

    const templateData = {
        name: payload.user.name,
        email: payload.user.email,
        OTP: otpValue,
        expiresIn: expirationSeconds / 60,
    };

    const html = await ejs.renderFile(templatePath, templateData);

    await transporter.sendMail({
        from: config.email_sender,
        to: payload.user.email,
        subject: "Email Verification",
        html,
    });

    return doctorApplication;
};

const verifyDoctorEmail = async (payload: any) => {
    // const email = payload.email.trim().toLowerCase();
    // const otp = payload.otp;
    // const isUserExists = await prisma.user.findUnique({
    // 	where: { email },
    // });
    // if (isUserExists?.status === "BLOCKED") {
    // 	throw new Error("User is Blocked!");
    // }
    // if (isUserExists?.emailVerified) {
    // 	throw new Error("Email Already Varified!");
    // }
    // if (isUserExists?.isDeleted || isUserExists?.status === "DELETED") {
    // 	throw new Error("User is Deleted!");
    // }
    // // if (isUserExists.googleId && isUserExists.authProvider === "GOOGLE") {
    // //     throw new Error("User Has Account With Google!");
    // // }
    // const otpKey = `patient-registration-otp: ${email}`;
    // const redisOTP = await redisClient.get(otpKey);
    // if (!redisOTP) {
    // 	throw new Error("Invalid OTP!");
    // }
    // if (redisOTP !== otp) {
    // 	throw new Error("OTP does not match!");
    // }
    // await redisClient.del(otpKey);
    // const patientRegistrationKey = `patient-registration-data: ${email}`;
    // const redisPatientData = await redisClient.get(patientRegistrationKey);
    // if (!redisPatientData) {
    // 	throw new Error("Invalid Patient Data!");
    // }
    // const patientPayload: IRegisterPatientPayload = JSON.parse(redisPatientData);
    // const createdUser = await prisma.user.create({
    // 	data: {
    // 		name: patientPayload.name,
    // 		email: patientPayload.email,
    // 		password: patientPayload.password,
    // 		role: Role.PATIENT,
    // 		status: UserStatus.ACTIVE,
    // 		emailVerified: true,
    // 		patient: {
    // 			create: {
    // 				name: patientPayload.name,
    // 				email: patientPayload.email,
    // 				contactNumber: patientPayload.patient.contactNumber || "",
    // 			},
    // 		},
    // 	},
    // 	omit: { password: true },
    // 	include: { patient: true },
    // });
    // await redisClient.del(patientRegistrationKey);
    // const templatePath = path.join(
    // 	process.cwd(),
    // 	"src/app/templates/patient-welcome-email.ejs",
    // );
    // const templateData = {
    // 	name: createdUser.name,
    // };
    // const html = await ejs.renderFile(templatePath, templateData);
    // await transporter.sendMail({
    // 	from: config.email_sender,
    // 	to: createdUser.email,
    // 	subject: "Welcome to PH Healthcare System!",
    // 	html,
    // });
    // const { patient, ...user } = createdUser;
    // const jwtPayload = {
    // 	userId: user.id,
    // 	name: user.name,
    // 	email: user.email,
    // 	role: user.role,
    // };
    // const accessToken = jwtUtils.createToken(
    // 	jwtPayload,
    // 	config.jwt_access_secret,
    // 	config.jwt_access_expires_in as SignOptions,
    // );
    // const refreshToken = jwtUtils.createToken(
    // 	jwtPayload,
    // 	config.jwt_refresh_secret,
    // 	config.jwt_refresh_expires_in as SignOptions,
    // );
    // return {
    // 	user,
    // 	patient,
    // 	accessToken,
    // 	refreshToken,
    // };
};

export const DoctorServices = {
    applyAsDoctor,
    verifyDoctorEmail,
};

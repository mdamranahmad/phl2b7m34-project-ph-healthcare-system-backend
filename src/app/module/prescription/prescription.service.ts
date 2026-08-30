import httpStatus from "http-status";
import { Role } from "../../../generated/prisma/enums";
import type { PaymentWhereInput } from "../../../generated/prisma/models";
import type { IQuery } from "../../interfaces";
import { prisma } from "../../lib/prisma";
import type { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/AppError";

const createPrescription = async () => {};
const getSinglePrescription = async () => {};

export const PrescriptionServices = {
	createPrescription,
	getSinglePrescription,
};

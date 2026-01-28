import {Request} from "express";
import {MissingUserContextError, ValidationError} from "./errors";
import {User} from "../models/User";

export async function loadCurrentUser(req: Request) {
    if (!req.user) throw new MissingUserContextError({route: req.path, note: 'req.user missing in loadCurrentUser'});

    const user = await User.findById(req.user.dialist_id).select([
        "first_name",
        "last_name",
        "email",
        "display_name",
        "display_name_history",
        "display_name_last_changed_at",
        "avatar",
        "legal_acks",
        "location",
        "onboarding",
    ].join(" "));
    if (!user) throw new ValidationError("User not found");
    return user;
}
export async function getCurrentUserByID(id: string) {
    const user = await User.findById(id).select([
        "first_name",
        "last_name",
        "email",
        "display_name",
        "display_name_history",
        "display_name_last_changed_at",
        "avatar",
        "legal_acks",
        "location",
        "onboarding",
    ].join(" "));
    if (!user) throw new ValidationError("User not found");
    return user;
}

export async function getCurrentUserByExternalID(external_id: string) {
    const user = await User.findOne({ external_id }).select([
        "first_name",
        "last_name",
        "email",
        "display_name",
        "display_name_history",
        "display_name_last_changed_at",
        "avatar",
        "legal_acks",
        "location",
        "onboarding",
    ].join(" "));

    if (!user) throw new ValidationError("User not found");
    return user;
}

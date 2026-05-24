import * as memberService from "../services/member.service.js";

export async function list(req, res, next) {
  try {
    const members = await memberService.listMembers(req.user.homeId);
    res.json(members);
  } catch (e) {
    next(e);
  }
}

export async function invite(req, res, next) {
  try {
    const result = await memberService.inviteMember(req.user.homeId, req.body);
    res.status(201).json(result);
  } catch (e) {
    next(e);
  }
}

export async function resendInvite(req, res, next) {
  try {
    const result = await memberService.resendInvitation(
      req.user.homeId,
      Number(req.params.id)
    );
    res.json(result);
  } catch (e) {
    next(e);
  }
}

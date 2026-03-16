import { Types } from "mongoose";
import { ConnectionService } from "../../../src/services/connection/ConnectionService";
import { Connection } from "../../../src/networks/models/Connection";
import { User } from "../../../src/models/User";
import { Block } from "../../../src/networks/models/Block";
import { feedService } from "../../../src/services/FeedService";

jest.mock("../../../src/networks/models/Connection");
jest.mock("../../../src/models/User");
jest.mock("../../../src/networks/models/Block");
jest.mock("../../../src/services/FeedService", () => ({
  feedService: {
    follow: jest.fn(),
    unfollow: jest.fn(),
  },
}));

describe("ConnectionService", () => {
  let connectionService: ConnectionService;

  beforeEach(() => {
    jest.clearAllMocks();
    connectionService = new ConnectionService();
  });

  it("rejects self-connections", async () => {
    const userId = new Types.ObjectId().toString();

    await expect(
      connectionService.requestConnection(userId, userId),
    ).rejects.toThrow("Cannot connect with yourself");
  });

  it("creates a pending connection request", async () => {
    const requesterId = new Types.ObjectId().toString();
    const targetId = new Types.ObjectId().toString();

    (User.findById as jest.Mock).mockResolvedValue({ _id: targetId });
    (Block.findOne as jest.Mock).mockResolvedValue(null);
    (Connection.findOne as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    const mockConnection = {
      _id: new Types.ObjectId(),
      follower_id: new Types.ObjectId(requesterId),
      following_id: new Types.ObjectId(targetId),
      status: "pending",
    };

    (Connection.create as jest.Mock).mockResolvedValue(mockConnection);
    (Notification.create as jest.Mock).mockResolvedValue({});
    (User.findById as jest.Mock).mockResolvedValue({
      _id: targetId,
      display_name: "Target User",
    });

    const result = await connectionService.requestConnection(
      requesterId,
      targetId,
    );

    expect(result.status).toBe("pending");
    expect(Connection.create).toHaveBeenCalled();
  });

  it("accepts an incoming pending request", async () => {
    const targetId = new Types.ObjectId().toString();
    const requesterId = new Types.ObjectId().toString();

    const mockConnection = {
      _id: new Types.ObjectId(),
      follower_id: new Types.ObjectId(requesterId),
      following_id: new Types.ObjectId(targetId),
      status: "pending",
      accepted_at: null,
      save: jest.fn().mockResolvedValue(true),
    };

    (Connection.findById as jest.Mock).mockResolvedValue(mockConnection);
    (Connection.getOutgoingCount as jest.Mock).mockResolvedValue(1);
    (Connection.getIncomingCount as jest.Mock).mockResolvedValue(1);
    (User.findByIdAndUpdate as jest.Mock).mockResolvedValue({});
    (feedService.follow as jest.Mock).mockResolvedValue({});
    (User.findById as jest.Mock).mockReturnValue({
      select: jest.fn().mockResolvedValue({ display_name: "Target" }),
    });
    (Notification.create as jest.Mock).mockResolvedValue({});

    const result = await connectionService.acceptConnectionRequest(
      targetId,
      mockConnection._id.toString(),
    );

    expect(result.status).toBe("accepted");
    expect(mockConnection.save).toHaveBeenCalled();
    expect(feedService.follow).toHaveBeenCalledWith(requesterId, targetId);
  });

  it("removes an accepted connection and syncs feeds", async () => {
    const requesterId = new Types.ObjectId().toString();
    const targetId = new Types.ObjectId().toString();

    (Connection.findOneAndDelete as jest.Mock).mockResolvedValue({
      status: "accepted",
    });
    (Connection.getOutgoingCount as jest.Mock).mockResolvedValue(0);
    (Connection.getIncomingCount as jest.Mock).mockResolvedValue(0);
    (User.findByIdAndUpdate as jest.Mock).mockResolvedValue({});
    (feedService.unfollow as jest.Mock).mockResolvedValue({});

    await connectionService.removeConnection(requesterId, targetId);

    expect(Connection.findOneAndDelete).toHaveBeenCalledWith({
      follower_id: requesterId,
      following_id: targetId,
    });
    expect(feedService.unfollow).toHaveBeenCalledWith(requesterId, targetId);
  });
});

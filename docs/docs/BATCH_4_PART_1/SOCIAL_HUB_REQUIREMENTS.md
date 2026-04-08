# Batch 4 Part 1: Social Hub Messaging System - Requirements Analysis

**Date:** April 6, 2026  
**Status:** Part 1 Analysis - [Awaiting Parts 2, 3, 4]  
**Scope:** 8 Figma screens covering messaging hub, discovery, and group chat functionality

---

## 1. Executive Summary

Batch 4 Part 1 introduces the **Social Hub** — a unified messaging and social discovery platform integrated into the Networks platform. The system comprises:

- **Messaging Tab** — Search, navigate, and manage conversations (1:1 chats and group chats)
- **Discovery Features** — Friend requests, group requests, and browsable member/group search
- **Group Chat** — Multi-user conversation thread with reactions, replies, and moderation
- **Chat Details** — User profile integration with transaction history and content library access

**Integration Point:** Networks platform (`/networks/social-hub`, `/networks/messages`, `/networks/groups`)  
**External Dependency:** GetStream Chat API (based on previous batch patterns)  
**Data Models:** User, Message, Group, ChatChannel, FriendRequest, GroupRequest, MessageReaction

---

## 2. Screen-by-Screen Breakdown

### Screen 1: Social Hub Header & Navigation

**Purpose:** Primary entry point showing tab-based navigation between messaging and reference checking features.

**Visual Elements:**
- Top-left: Current user avatar (circular, with online status indicator)
- Center: "Social Hub" title
- Top-right: User profile icon (opens user menu)
- Tab bar: "Messages" (active/default) | "Reference Checks" (secondary)
- Search input: Placeholder "Search messages" with magnifying glass icon

**Functional Requirements:**

| Requirement | Details |
|-----------|---------|
| **Tab Switching** | Messages ↔ Reference Checks; active tab highlighted with white background |
| **Search Input** | Real-time search across messages, users, groups; debounced 300ms |
| **User Presence** | Green dot on avatar = online; absence = offline or away |
| **Profile Navigation** | Top-right icon → opens profile menu (account settings, logout) |
| **Navigation State** | Remember last active tab across sessions |

**API Endpoints Needed:**
- `GET /networks/social-hub/status` — Check user messaging status, unread count
- `GET /networks/messages/search` — Full-text search (query: string, type: "user"|"group"|"message", limit: 20)

**Request Examples:**
```json
{
  "GET /networks/social-hub/status": {
    "query": {}
  },
  "GET /networks/messages/search": {
    "query": {
      "q": "micheal",
      "type": "user | group | message",
      "limit": 20,
      "offset": 0
    }
  }
}
```

**Response Examples:**
```json
{
  "GET /networks/social-hub/status": {
    "data": {
      "user_id": "user_123",
      "display_name": "John Doe",
      "avatar_url": "https://...",
      "online_status": "online",
      "unread_messages": 42,
      "unread_group_chats": 3,
      "unread_personal_chats": 8
    },
    "requestId": "uuid"
  },
  "GET /networks/messages/search": {
    "data": {
      "results": [
        {
          "type": "user",
          "user_id": "user_456",
          "display_name": "Michael",
          "avatar_url": "https://...",
          "online_status": "online",
          "is_friend": true
        },
        {
          "type": "group",
          "group_id": "grp_789",
          "name": "Watch Collectors Club",
          "avatar_url": "https://...",
          "member_count": 12,
          "unread_count": 5
        },
        {
          "type": "message",
          "message_id": "msg_001",
          "sender": "Michael",
          "content": "Is it still available?",
          "timestamp": "2026-04-06T02:14:00Z",
          "chat_id": "chat_123"
        }
      ],
      "total": 3,
      "hasMore": false
    },
    "requestId": "uuid"
  }
}
```

**Data Model Requirements:**
```typescript
interface SocialHubStatus {
  user_id: ObjectId;
  display_name: string;
  avatar_url: string | null;
  online_status: "online" | "away" | "offline";
  unread_messages: number;
  unread_group_chats: number;
  unread_personal_chats: number;
  last_activity: Date;
}

interface SearchResult {
  type: "user" | "group" | "message";
  matchedFields: string[];
  relevanceScore: number;
}
```

---

### Screen 2: Search Results — Inquiry Message

**Purpose:** Display filtered search results showing message threads with preview context.

**Visual Elements:**
- Search input: Pre-populated "Is It |" (cursor shown)
- Result count: "3 Results"
- Result card: Avatar | Name | Message tag + inquiry preview | Timestamp | Unread badge (red circle with "1")
- Card layout: Daniel Atkins | Label "Inquiry" (blue) | "Is it still available?" | "2:14 PM" | Unread(1)

**Functional Requirements:**

| Requirement | Details |
|-----------|---------|
| **Search Filtering** | Scoped to "Messages" tab only; shows query-matched conversations |
| **Result Types** | Include: individual messages, conversation threads, group mentions |
| **Message Tags** | "Inquiry" (blue), "Offer" (green), "Review" (purple) — indicates message type |
| **Unread Indicator** | Red badge in top-right of card; number indicates unread count in chat |
| **Timestamp Display** | Human-readable format: "2:14 PM" (today), "2d ago" (older), "Yesterday" |
| **Tap to Open** | Clicking result opens full conversation thread (navigates to Screen 7) |
| **Result Ordering** | Most recent first; unread conversations pinned to top |

**API Endpoints Needed:**
- `GET /networks/messages/search` — Already defined in Screen 1

**Response Example (Enhanced):**
```json
{
  "data": {
    "results": [
      {
        "type": "message",
        "message_id": "msg_001",
        "chat_id": "chat_123",
        "sender": {
          "user_id": "user_456",
          "display_name": "Daniel Atkins",
          "avatar_url": "https://...",
          "online_status": "online"
        },
        "content": "Is it still available?",
        "message_tag": "inquiry",
        "timestamp": "2026-04-06T02:14:00Z",
        "unread_count": 1,
        "is_pinned": false,
        "reactions": [
          { "emoji": "👍", "count": 1, "current_user_reacted": false }
        ]
      }
    ],
    "total": 3,
    "hasMore": false
  },
  "requestId": "uuid"
}
```

**Data Model Requirements:**
```typescript
interface MessageSearchResult {
  message_id: ObjectId;
  chat_id: ObjectId;
  sender: UserPreview;
  content: string;
  message_tag?: "inquiry" | "offer" | "review" | "listing_inquiry";
  timestamp: Date;
  unread_count: number;
  is_pinned: boolean;
  reactions: MessageReaction[];
}

interface MessageReaction {
  emoji: string;
  count: number;
  current_user_reacted: boolean;
}
```

---

### Screen 3: Messages Tab — Empty Group Chats State

**Purpose:** Show empty state when user has no personal 1:1 messages but displays group chat summary.

**Visual Elements:**
- Search input: "Search messages" placeholder
- Section header: "Group Chats" with group icon | "3 active groups" subtitle
- Badge: "999+" (red) indicates unread messages across all groups
- Empty state below: Group icon | "No Messages" title | "Join a community or start a new group..." text
- CTA: "Find Friends" (black button)

**Functional Requirements:**

| Requirement | Details |
|-----------|---------|
| **Group Chat Summary** | Always visible at top; shows count of active groups user belongs to |
| **Unread Badge** | Displays aggregated unread count across ALL groups; shows "999+" if exceeds 999 |
| **Empty State Logic** | Show when: user has no personal 1:1 chats; still show group section if groups exist |
| **Find Friends CTA** | Navigation to discovery flow (Screen 5) |
| **Tap Group Section** | Opens group chats list (Screen 4 variant showing group-only view) |
| **Scroll Behavior** | Group section acts as sticky header; can be collapsed/expanded |

**API Endpoints Needed:**
- `GET /networks/messages/groups` — Fetch user's group chats with unread stats
- `GET /networks/messages/personal` — Fetch user's 1:1 chats (returns empty if no messages)

**Request Examples:**
```json
{
  "GET /networks/messages/groups": {
    "query": {
      "include_unread": true,
      "limit": 10,
      "offset": 0
    }
  },
  "GET /networks/messages/personal": {
    "query": {
      "include_unread": true,
      "limit": 50,
      "offset": 0
    }
  }
}
```

**Response Examples:**
```json
{
  "GET /networks/messages/groups": {
    "data": {
      "groups": [
        {
          "group_id": "grp_001",
          "name": "Watch Collectors Club",
          "avatar_url": "https://...",
          "member_count": 12,
          "online_member_count": 4,
          "unread_count": 15,
          "last_message": {
            "sender": "Sarah Kim",
            "content": "Has anyone seen the new release from Omega today?",
            "timestamp": "2026-04-06T10:23:00Z"
          }
        }
      ],
      "total_groups": 3,
      "total_unread": 999,
      "_metadata": {
        "groupsWithUnread": 3,
        "hasMore": false
      }
    },
    "requestId": "uuid"
  },
  "GET /networks/messages/personal": {
    "data": {
      "chats": [],
      "total": 0,
      "_metadata": { "hasMore": false }
    },
    "requestId": "uuid"
  }
}
```

**Data Model Requirements:**
```typescript
interface GroupChatSummary {
  group_id: ObjectId;
  name: string;
  avatar_url: string | null;
  member_count: number;
  online_member_count: number;
  unread_count: number;
  last_message?: {
    sender: string;
    content: string;
    timestamp: Date;
  };
  is_muted: boolean;
  joined_at: Date;
}

interface PersonalChatsSummary {
  chats: PersonalChat[];
  total: number;
  totalUnread: number;
}

interface PersonalChat {
  chat_id: ObjectId;
  participant: UserPreview;
  last_message: string;
  last_message_time: Date;
  unread_count: number;
}
```

---

### Screen 4: Personal Chats List — Mixed Conversations

**Purpose:** Display both 1:1 personal chats and group chats in unified conversation list.

**Visual Elements:**
- Search input: "Search messages"
- Stack of conversation cards:
  1. **Group Chat:** "Watch Collectors Club" | Group avatar | "New event coming up next week..." | "2d ago" | Badge "39"
  2. **Personal 1:1:** "Sandra Dorsett" | User avatar | "See offer attached" | "3:00 PM" | Checkmark (read status)
  3. **Group Chat:** "Rolex Collectors Group" | Group avatar (initial "R") | "Anyone seen the new release?" | "Yesterday" | Badge "5"

**Functional Requirements:**

| Requirement | Details |
|-----------|---------|
| **Unified List** | Mix 1:1 and group chats chronologically; sort by last message time |
| **Chat Card Content** | Avatar | Name | Preview text (truncated, last message) | Time | Unread badge or read indicator |
| **Unread Badge** | Red circle with number; only shows if count > 0 |
| **Read Indicator** | Double checkmark (✓✓) for read messages; single checkmark for delivered |
| **Online Status** | Green dot on participant avatar (1:1 only) |
| **Muted Chats** | Display slightly grayed out; muted icon shown |
| **Tap Card** | Opens full conversation thread (ChatDetail view) |
| **Swipe Actions** | (Mobile) Swipe left: mute/unmute, delete; swipe right: mark read/unread |
| **Context Menu** | Long-press: Pin, Mute, Mark Unread, Delete, Report |
| **Drag to Reorder** | (Optional desktop feature) drag conversation to reorder |

**API Endpoints Needed:**
- `GET /networks/messages/chats` — Fetch all user conversations (personal + group)
- `PATCH /networks/messages/chats/:chatId/mute` — Mute/unmute conversation
- `DELETE /networks/messages/chats/:chatId` — Delete/archive conversation
- `PATCH /networks/messages/chats/:chatId/read` — Mark conversation as read

**Request Examples:**
```json
{
  "GET /networks/messages/chats": {
    "query": {
      "include_unread": true,
      "include_preview": true,
      "limit": 50,
      "offset": 0,
      "sort_by": "last_activity"
    }
  },
  "PATCH /networks/messages/chats/chat_123/mute": {
    "body": {
      "mute": true,
      "mute_duration": "forever" // or "1h", "8h", "24h"
    }
  },
  "PATCH /networks/messages/chats/chat_123/read": {
    "body": {
      "mark_as": "read" // or "unread"
    }
  },
  "DELETE /networks/messages/chats/chat_123": {
    "query": {
      "action": "delete" // or "archive"
    }
  }
}
```

**Response Examples:**
```json
{
  "GET /networks/messages/chats": {
    "data": {
      "chats": [
        {
          "chat_id": "chat_001",
          "type": "group",
          "group": {
            "group_id": "grp_001",
            "name": "Watch Collectors Club",
            "avatar_url": "https://..."
          },
          "last_message": {
            "content": "New event coming up next week...",
            "sender": "Sarah Kim",
            "timestamp": "2026-04-04T14:30:00Z",
            "is_read": false
          },
          "unread_count": 39,
          "is_muted": false,
          "is_pinned": false
        },
        {
          "chat_id": "chat_002",
          "type": "personal",
          "participant": {
            "user_id": "user_456",
            "display_name": "Sandra Dorsett",
            "avatar_url": "https://...",
            "online_status": "offline"
          },
          "last_message": {
            "content": "See offer attached",
            "sender": "Sandra Dorsett",
            "timestamp": "2026-04-06T15:00:00Z",
            "is_read": true
          },
          "unread_count": 0,
          "is_muted": false,
          "is_pinned": false
        }
      ],
      "total": 50,
      "total_unread": 44
    },
    "requestId": "uuid"
  }
}
```

**Data Model Requirements:**
```typescript
interface Chat {
  chat_id: ObjectId;
  type: "personal" | "group";
  group?: GroupPreview;
  participant?: UserPreview;
  last_message: {
    content: string;
    sender: string;
    timestamp: Date;
    is_read: boolean;
  };
  unread_count: number;
  is_muted: boolean;
  is_pinned: boolean;
  created_at: Date;
  updated_at: Date;
}

interface ChatMuteSettings {
  is_muted: boolean;
  mute_until?: Date;
  mute_duration: "forever" | "1h" | "8h" | "24h";
}
```

---

### Screen 5: Find Members & Groups — Request Management

**Purpose:** Centralized view for managing incoming friend and group requests.

**Visual Elements:**
- Back arrow (← navigation)
- Title: "Find Members & Groups"
- QR code icon (top right)
- Search input: "Search by name, username, or phone..."
- **FRIEND REQUEST Section:**
  - List of users with: Avatar | Name | Follower count | Mutual friends count | Accept button | Decline button
  - Users: David Lee (8.2k Followers, 12 mutual), Sophia Chen (5.3k, 8 mutual), Michael Smith (10.5k, 15 mutual), Emily Johnson (7.8k, 10 mutual)
  - "See All" link (top-right of section)
- **GROUP REQUEST Section:**
  - List of groups: Watch Collectors Club (10.5k, 15 mutual) | Gadget Enthusiasts Group (8.2k, 10 mutual) | Book Lovers Society (12.1k, 20 mutual) | Travel Explorers Network (15.8k, 5 mutual)
  - "See All" link
- **CTA Box:** "Invite Friends to Dialist" | "Build your trusted network. The more verified connections you have, the stronger your reputation becomes." | "Share Invite Link" button

**Functional Requirements:**

| Requirement | Details |
|-----------|---------|
| **Friend Requests Section** | Show pending friend requests; up to 4; "See All" expands to full list |
| **Accept Friend** | Button click → update request status to "accepted" → add to friend list → notify other user |
| **Decline Friend** | Button click → remove request → notify other user of decline |
| **Group Requests Section** | Show pending group requests/invitations; similar layout to friend requests |
| **Accept Group** | Button click → join group → update member list → mark request resolved |
| **Decline Group** | Button click → decline invite → remove request |
| **Mutual Connections** | Display count of mutual friends/members (computed field) |
| **Search Within Requests** | Filter by name/username on current page only |
| **QR Code Button** | Opens QR scanner to add friends by scanning |
| **Invite Link Generation** | Tap "Share Invite Link" → generate unique invite URL → copy to clipboard or share via system |
| **Notification Sync** | Fetch requests on view load + subscribe to real-time updates |

**API Endpoints Needed:**
- `GET /networks/friend-requests` — Fetch pending friend requests
- `POST /networks/friend-requests/:requestId/accept` — Accept friend request
- `POST /networks/friend-requests/:requestId/decline` — Decline friend request
- `GET /networks/group-requests` — Fetch pending group requests
- `POST /networks/group-requests/:requestId/accept` — Accept group request
- `POST /networks/group-requests/:requestId/decline` — Decline group request
- `POST /networks/invite-link/generate` — Generate invite link
- `GET /networks/user/mutual-connections/:userId` — Calculate mutual connections

**Request Examples:**
```json
{
  "GET /networks/friend-requests": {
    "query": {
      "status": "pending",
      "limit": 10,
      "offset": 0,
      "include_mutual_count": true
    }
  },
  "POST /networks/friend-requests/req_123/accept": {
    "body": {
      "action": "accept"
    }
  },
  "POST /networks/friend-requests/req_123/decline": {
    "body": {
      "action": "decline",
      "reason": "optional decline reason"
    }
  },
  "POST /networks/invite-link/generate": {
    "body": {
      "expiration_days": 30
    }
  }
}
```

**Response Examples:**
```json
{
  "GET /networks/friend-requests": {
    "data": {
      "requests": [
        {
          "request_id": "req_001",
          "from_user": {
            "user_id": "user_001",
            "display_name": "David Lee",
            "avatar_url": "https://...",
            "follower_count": 8200,
            "mutual_connections": 12
          },
          "status": "pending",
          "created_at": "2026-04-05T10:00:00Z"
        }
      ],
      "total": 4,
      "_metadata": { "hasMore": true }
    },
    "requestId": "uuid"
  },
  "POST /networks/friend-requests/req_123/accept": {
    "data": {
      "request_id": "req_123",
      "status": "accepted",
      "new_friend": {
        "user_id": "user_001",
        "display_name": "David Lee",
        "connection_established_at": "2026-04-06T12:00:00Z"
      }
    },
    "requestId": "uuid"
  },
  "POST /networks/invite-link/generate": {
    "data": {
      "invite_link": "https://dialist.app/join/abc123xyz",
      "expires_at": "2026-05-06T12:00:00Z",
      "usage_count": 0,
      "max_usages": null
    },
    "requestId": "uuid"
  }
}
```

**Data Model Requirements:**
```typescript
interface FriendRequest {
  request_id: ObjectId;
  from_user_id: ObjectId;
  to_user_id: ObjectId;
  status: "pending" | "accepted" | "declined";
  created_at: Date;
  updated_at: Date;
  declined_reason?: string;
}

interface GroupRequest {
  request_id: ObjectId;
  user_id: ObjectId;
  group_id: ObjectId;
  status: "pending" | "accepted" | "declined";
  request_type: "invite" | "join_request";
  created_at: Date;
  updated_at: Date;
}

interface InviteLink {
  link_id: ObjectId;
  creator_id: ObjectId;
  invite_code: string;
  expires_at: Date;
  usage_count: number;
  max_usages?: number;
}
```

---

### Screen 6: Find & Search Results — Discoverable Members & Groups

**Purpose:** Browsable directory of members and groups with filtering and follow actions.

**Visual Elements:**
- Back arrow
- Title: "Find Peoples & Groups"
- Search input: "Pate" (showing search in progress)
- **Filter Tabs:** All (active) | Friends | Groups
- Results showing:
  - **User Card 1:** "Sophia Patel" | "Toronto, ON • 5.4k Followers" | "Follow" button (black)
  - **Group Card 1:** "Patek Collectors Toronto" | "Toronto, ON • 5.4k Followers" | "Follow" button
- CTA Box (bottom): "Invite Friends to Dialist" with "Share Invite Link" button

**Functional Requirements:**

| Requirement | Details |
|-----------|---------|
| **Search Functionality** | Real-time search across users & groups; filters by display_name, location |
| **Filter Tabs** | All (combined) | Friends (only non-friends) | Groups (communities only) |
| **Result Card Types** | User card vs Group card — different info density |
| **User Card Fields** | Avatar | Display name | Location | Follower count | Follow button |
| **Group Card Fields** | Avatar | Group name | Location | Follower count | Member count | Follow button |
| **Follow Action** | Tap "Follow" → sends friend/join request → updates UI (button becomes "Following" or "Pending") |
| **Location Display** | "City, Province • Follower Count" format |
| **Pagination** | Load more results on scroll; lazy load images |
| **No Results State** | "No results found" — show when search yields nothing |
| **Sort Order** | Default: relevance/recent; can sort by followers, recently joined |

**API Endpoints Needed:**
- `GET /networks/discovery/search` — Search users & groups
- `POST /networks/users/:userId/follow` — Follow/send friend request to user
- `POST /networks/groups/:groupId/follow` — Join/request to join group

**Request Examples:**
```json
{
  "GET /networks/discovery/search": {
    "query": {
      "q": "pate",
      "type": "all", // or "users", "groups"
      "limit": 20,
      "offset": 0,
      "sort_by": "relevance" // or "followers", "recent"
    }
  },
  "POST /networks/users/user_123/follow": {
    "body": {
      "action": "follow"
    }
  },
  "POST /networks/groups/grp_456/follow": {
    "body": {
      "action": "follow"
    }
  }
}
```

**Response Examples:**
```json
{
  "GET /networks/discovery/search": {
    "data": {
      "results": [
        {
          "type": "user",
          "user_id": "user_789",
          "display_name": "Sophia Patel",
          "avatar_url": "https://...",
          "location": {
            "city": "Toronto",
            "province": "ON",
            "country": "CA"
          },
          "follower_count": 5400,
          "is_friend": false,
          "follow_status": "none" // or "requested", "following"
        },
        {
          "type": "group",
          "group_id": "grp_012",
          "name": "Patek Collectors Toronto",
          "avatar_url": "https://...",
          "description": "Luxury watch enthusiasts in Toronto",
          "location": {
            "city": "Toronto",
            "province": "ON",
            "country": "CA"
          },
          "member_count": 145,
          "follower_count": 5400,
          "join_status": "none" // or "requested", "joined"
        }
      ],
      "total": 2,
      "hasMore": false
    },
    "requestId": "uuid"
  },
  "POST /networks/users/user_123/follow": {
    "data": {
      "user_id": "user_123",
      "follow_status": "requested",
      "friend_request": {
        "request_id": "req_789",
        "status": "pending",
        "created_at": "2026-04-06T12:00:00Z"
      }
    },
    "requestId": "uuid"
  }
}
```

**Data Model Requirements:**
```typescript
interface DiscoveryUser {
  user_id: ObjectId;
  display_name: string;
  avatar_url: string | null;
  location: {
    city: string;
    province: string;
    country: string;
  };
  follower_count: number;
  is_friend: boolean;
  follow_status: "none" | "requested" | "following";
}

interface DiscoveryGroup {
  group_id: ObjectId;
  name: string;
  avatar_url: string | null;
  description: string;
  location: Location;
  member_count: number;
  follower_count: number;
  join_status: "none" | "requested" | "joined";
}

interface FollowAction {
  follower_id: ObjectId;
  following_id: ObjectId;
  follow_status: "requested" | "accepted" | "declined" | "blocked";
  created_at: Date;
}
```

---

### Screen 7: Group Chat Thread — Chat Interaction

**Purpose:** Display active group conversation with message history, reactions, and message actions.

**Visual Elements:**
- Back arrow + Group header: "Watch Collectors Club" | Member count "12 members, 4 online" | Menu (⋯)
- Date separator: "Today, 10:23 AM"
- Message 1 (from Sarah Kim): "Has anyone seen the new release from Omega today? It's stunning." | Timestamp "10:23 AM"
- Message 2 (from David Chen): "I did! The green dial is incredible. I might have to visit the boutique this weekend." | Timestamp "10:24 AM"
- Message 3 (current user - green bubble): "I'm actually heading there tomorrow if anyone wants me to check availability." | Reactions below (❤️ 👍 👎 LOL ❓) | Timestamp "10:25 AM"
- Message 4 (current user continuation): "Oh wow, looks mint. GLWS!" | Reactions (LOL shown) | Timestamp "~1 AM"
- User mention: "Slim Aarons..." (tooltip/tag)
- Message actions menu (triggered by long-press on message 4):
  - ↩️ Reply
  - ≡ Thread Reply
  - 📋 Copy Message
  - ✏️ Edit Message
  - 👤 Block User
  - 🗑️ Delete Message (red) (only for own messages or moderators)
- Bottom input: Paper clip icon | "Message..." placeholder | Emoji picker | Microphone icon

**Functional Requirements:**

| Requirement | Details |
|-----------|---------|
| **Message Display** | Chronological order; latest at bottom; paginate upward on scroll |
| **Message Bubble Styling** | Sent (green/light) vs received (gray/dark); align right vs left |
| **Timestamps** | Show in-message for received; show on hover/beside for sent |
| **Date Separators** | "Today, HH:MM AM/PM" or "Yesterday" or "DD/MM/YYYY" format |
| **User Attribution** | Show sender name + avatar for received messages; omit for sent (current user) |
| **Online Status** | Green dot on avatar indicates current online status |
| **Message Tags** | Optional: "Inquiry", "Offer" labels on relevant messages |
| **Reactions** | Tap reaction spot to toggle emoji reactions; show React counter |
| **Reply Quotes** | Quoted message shows in smaller, indented format with sender name |
| **Thread Replies** | Tap "Thread Reply" → open thread view (separate sub-conversation) |
| **Message Actions:**
  - **Reply** | Opens reply compose with quoted message |
  - **Thread Reply** | Opens thread view for that message |
  - **Copy Message** | Copy text to clipboard |
  - **Edit Message** | (Own messages only) Reopen compose with message text, allow edit |
  - **Block User** | Block user from future messages (shows confirm dialog) |
  - **Delete Message** | (Own messages or moderators) Removes message (shows "deleted" placeholder) |
| **Message Input** | Multiline text input; supports @mentions of group members |
| **Attachments** | Paper clip button → file picker (images, documents) |
| **Emoji Picker** | Tap emoji icon or long-press send button |
| **Audio Messages** | Tap microphone → record → send (or discard) |
| **Typing Indicators** | Show "User is typing..." below last message |
| **Read Receipts** | Single ✓ (sent) | Double ✓✓ (delivered) | Blue double ✓✓ (read); update on scroll into view |
| **Mark as Read** | Automatically mark as read when message enters viewport |
| **Group Header** | Show member count + online member count; tap to open group details |

**API Endpoints Needed:**
- `GET /networks/messages/:chatId/history` — Fetch message history (paginated)
- `POST /networks/messages/:chatId/send` — Send message to chat
- `PATCH /networks/messages/:messageId/edit` — Edit own message
- `DELETE /networks/messages/:messageId` — Delete message
- `POST /networks/messages/:messageId/react` — Add/remove emoji reaction
- `POST /networks/messages/:messageId/reply` — Reply to message (creates reference)
- `POST /networks/messages/:messageId/thread` — Open/fetch thread for message
- `POST /networks/messages/:chatId/read-receipt` — Mark message as read
- `GET /networks/groups/:groupId` — Fetch group details (for header display)

**Request Examples:**
```json
{
  "GET /networks/messages/chat_001/history": {
    "query": {
      "limit": 30,
      "before": "msg_timestamp_or_id",
      "after": null
    }
  },
  "POST /networks/messages/chat_001/send": {
    "body": {
      "content": "I'm actually heading there tomorrow if anyone wants me to check availability.",
      "attachments": [],
      "mentions": [],
      "reply_to": null
    }
  },
  "POST /networks/messages/msg_123/react": {
    "body": {
      "emoji": "❤️",
      "action": "add" // or "remove"
    }
  },
  "PATCH /networks/messages/msg_123/edit": {
    "body": {
      "content": "Updated message content"
    }
  },
  "DELETE /networks/messages/msg_123": {
    "query": {
      "soft_delete": true
    }
  }
}
```

**Response Examples:**
```json
{
  "GET /networks/messages/chat_001/history": {
    "data": {
      "messages": [
        {
          "message_id": "msg_001",
          "chat_id": "chat_001",
          "sender": {
            "user_id": "user_001",
            "display_name": "Sarah Kim",
            "avatar_url": "https://...",
            "online_status": "online"
          },
          "content": "Has anyone seen the new release from Omega today? It's stunning.",
          "type": "text",
          "timestamp": "2026-04-06T10:23:00Z",
          "edited_at": null,
          "reactions": [ { "emoji": "👍", "count": 2, "current_user_reacted": false } ],
          "reply_to": null,
          "read_by": ["user_123", "user_456"],
          "attachments": []
        }
      ],
      "has_more": true
    },
    "requestId": "uuid"
  },
  "POST /networks/messages/chat_001/send": {
    "data": {
      "message": {
        "message_id": "msg_new_001",
        "chat_id": "chat_001",
        "sender": {
          "user_id": "user_123",
          "display_name": "Current User",
          "avatar_url": "https://..."
        },
        "content": "I'm actually heading there tomorrow...",
        "type": "text",
        "timestamp": "2026-04-06T10:25:00Z",
        "read_by": [],
        "reactions": []
      }
    },
    "requestId": "uuid"
  }
}
```

**Data Model Requirements:**
```typescript
interface Message {
  message_id: ObjectId;
  chat_id: ObjectId;
  sender_id: ObjectId;
  content: string;
  type: "text" | "image" | "file" | "audio";
  attachments: Attachment[];
  mentions: Mention[];
  reply_to?: ObjectId;
  thread_id?: ObjectId;
  reactions: Reaction[];
  read_by: ObjectId[];
  deleted: boolean;
  deleted_at?: Date;
  edited_at?: Date;
  created_at: Date;
  updated_at: Date;
}

interface Reaction {
  emoji: string;
  count: number;
  reactors: ObjectId[];
}

interface Attachment {
  id: ObjectId;
  type: "image" | "document" | "video";
  url: string;
  name: string;
  size: number;
}
```

---

### Screen 8: Chat Details — User Profile Integration

**Purpose:** Show detailed user information within chat context, including transaction history and content library.

**Visual Elements:**
- Back arrow
- Top section: User avatar (large circle, 120px) | Green online dot
- Display name: "Michael Lammens" (heading)
- Subtitle: "Member since 2021"
- Two buttons: "View Profile" | "Search in Chat"
- **Section: TRANSACTIONS**
  - Icon + Label: "Offers & Inquiries" with count "2 Active >"
  - Icon + Label: "Common Groups" with count "3 >"
- **Section: CONTENT**
  - Icon + Label: "Media" with count "12 >"
  - Icon + Label: "Links" with count "1 >"
  - Icon + Label: "Files" with count "2 >"
- **Section: PRIVACY & SUPPORT**
  - Icon + Label: "Mute Notifications" (toggle switch, currently off)
  - Icon + Label: "Report User" (red link)
  - Icon + Label: "Block User" (red link)

**Functional Requirements:**

| Requirement | Details |
|-----------|---------|
| **User Profile Header** | Avatar | Name | Member since date | Online status |
| **View Profile Button** | Navigate to user's full profile card (cross-platform, detailed view) |
| **Search in Chat** | Open message history filter for this user only |
| **Transactions Section** | Show active offers/inquiries count; tap to view transaction list |
| **Offers & Inquiries** | List of active marketplace interactions with this user |
| **Common Groups** | Groups both users are members of; show member count per group |
| **Content Section** | Shared media, links, files from conversations with this user |
| **Media** | Paginated grid of images sent/received; click to preview |
| **Links** | List of URLs shared in chat; click to navigate |
| **Files** | List of documents; tap to download or preview |
| **Mute Notifications** | Toggle to mute/unmute notifications from this user or group |
| **Report User** | Open report form; reasons: spam, harassment, inappropriate, etc. |
| **Block User** | Confirm dialog → block user from sending messages; remove existing messages option |
| **Delete Chat** | Long-press or menu → delete conversation history |

**API Endpoints Needed:**
- `GET /networks/users/:userId/profile` — Fetch user profile details
- `GET /networks/users/:userId/transactions` — Fetch active offers/inquiries with user
- `GET /networks/users/:userId/common-groups` — Fetch common groups
- `GET /networks/chats/:chatId/media` — Fetch shared media
- `GET /networks/chats/:chatId/links` — Fetch shared links
- `GET /networks/chats/:chatId/files` — Fetch shared files
- `PATCH /networks/users/:userId/mute` — Mute/unmute user
- `POST /networks/users/:userId/report` — Report user
- `POST /networks/users/:userId/block` — Block user

**Request Examples:**
```json
{
  "GET /networks/users/user_123/profile": {
    "query": {}
  },
  "GET /networks/users/user_123/transactions": {
    "query": {
      "status": "active",
      "limit": 10
    }
  },
  "GET /networks/users/user_123/common-groups": {
    "query": {
      "limit": 10
    }
  },
  "GET /networks/chats/chat_001/media": {
    "query": {
      "limit": 30,
      "offset": 0
    }
  },
  "POST /networks/users/user_123/report": {
    "body": {
      "reason": "harassment",
      "description": "User sent inappropriate messages",
      "attachments": []
    }
  },
  "POST /networks/users/user_123/block": {
    "body": {
      "action": "block",
      "clear_history": true
    }
  }
}
```

**Response Examples:**
```json
{
  "GET /networks/users/user_123/profile": {
    "data": {
      "user_id": "user_123",
      "display_name": "Michael Lammens",
      "avatar_url": "https://...",
      "bio": "Watch collector since 2010",
      "location": {
        "city": "Toronto",
        "province": "ON"
      },
      "follower_count": 2500,
      "following_count": 1200,
      "member_since": "2021-01-15T00:00:00Z",
      "verification_status": "verified",
      "online_status": "online",
      "reputation_score": 4.8
    },
    "requestId": "uuid"
  },
  "GET /networks/users/user_123/transactions": {
    "data": {
      "active_offers": [
        {
          "offer_id": "offer_001",
          "item": "Rolex Submariner",
          "price": 12000,
          "status": "accepted",
          "created_at": "2026-04-01T10:00:00Z"
        }
      ],
      "active_inquiries": [
        {
          "inquiry_id": "inq_001",
          "item": "Omega Seamaster",
          "question": "Is it still available?",
          "created_at": "2026-04-06T02:14:00Z"
        }
      ]
    },
    "requestId": "uuid"
  },
  "GET /networks/chats/chat_001/media": {
    "data": {
      "media": [
        {
          "media_id": "media_001",
          "type": "image",
          "url": "https://...",
          "source_message_id": "msg_234",
          "timestamp": "2026-04-05T14:30:00Z"
        }
      ],
      "total": 12,
      "hasMore": true
    },
    "requestId": "uuid"
  },
  "POST /networks/users/user_123/block": {
    "data": {
      "user_id": "user_123",
      "blocked": true,
      "chat_id": "chat_001",
      "history_cleared": true,
      "blocked_at": "2026-04-06T12:00:00Z"
    },
    "requestId": "uuid"
  }
}
```

**Data Model Requirements:**
```typescript
interface UserChatProfile {
  user_id: ObjectId;
  display_name: string;
  avatar_url: string | null;
  bio: string;
  member_since: Date;
  verification_status: "verified" | "unverified" | "suspended";
  online_status: "online" | "away" | "offline";
  follower_count: number;
  reputation_score: number;
}

interface UserTransaction {
  offer_id?: ObjectId;
  inquiry_id?: ObjectId;
  item_name: string;
  status: "active" | "completed" | "cancelled";
  created_at: Date;
}

interface ChatMuteSetting {
  chat_id: ObjectId;
  user_id: ObjectId;
  is_muted: boolean;
  mute_until: Date | null;
}

interface UserReport {
  report_id: ObjectId;
  reporter_id: ObjectId;
  reported_user_id: ObjectId;
  reason: "spam" | "harassment" | "inappropriate" | "fraud";
  description: string;
  status: "open" | "investigating" | "resolved";
  created_at: Date;
}

interface UserBlock {
  blocker_id: ObjectId;
  blocked_user_id: ObjectId;
  blocked_at: Date;
}
```

---

## 3. Cross-Platform Data Consistency

### Shared Models with Batch 2 & 3

| Model | Batch 4 Usage | Consistency Notes |
|-------|---------------|-------------------|
| **User** | Sender in messages, participant in chats | Must preserve onboarding state, location, verification |
| **Message** | Core messaging model | NEW model; similar to Listings comments but richer |
| **Group** | Container for group chats | Different from Batch 2 groups (collections); Batch 4 is social groups |
| **Offer** | Referenced in chat details transactions | Reuse existing Marketplace/Networks Offer model |
| **Inquiry** | Referenced in chat details transactions | Reuse existing Marketplace/Networks Inquiry model |

### New Models for Batch 4

| Model | Purpose | Primary Key | Relationships |
|-------|---------|------------|-----------------|
| **Chat** | Conversation container (1:1 or group) | `chat_id` | Links to User (1:1) or Group (group) |
| **Message** | Individual message in chat | `message_id` | References Chat, User (sender), Message (reply_to) |
| **Group** | Social group/community | `group_id` | Has many Users, Messages, Transactions |
| **FriendRequest** | Pending friend connection | `request_id` | Links from_user → to_user |
| **GroupRequest** | Pending group membership | `request_id` | Links user → group |
| **Reaction** | Emoji reaction on message | (emoji + message_id) | Points to Message, User who reacted |
| **InviteLink** | Shareable invite URL | `link_id` | Created by User, used to join platform |

---

## 4. API Summary

### Messaging Endpoints

```
POST   /networks/messages/:chatId/send
GET    /networks/messages/:chatId/history
PATCH  /networks/messages/:messageId/edit
DELETE /networks/messages/:messageId
POST   /networks/messages/:messageId/react
POST   /networks/messages/:messageId/reply
GET    /networks/messages/:messageId/thread
POST   /networks/messages/:chatId/read-receipt

GET    /networks/messages/chats
GET    /networks/messages/groups
GET    /networks/messages/personal
PATCH  /networks/messages/chats/:chatId/mute
DELETE /networks/messages/chats/:chatId

GET    /networks/messages/search
GET    /networks/social-hub/status
```

### Discovery Endpoints

```
GET    /networks/discovery/search
POST   /networks/users/:userId/follow
POST   /networks/groups/:groupId/follow

GET    /networks/friend-requests
POST   /networks/friend-requests/:requestId/accept
POST   /networks/friend-requests/:requestId/decline

GET    /networks/group-requests
POST   /networks/group-requests/:requestId/accept
POST   /networks/group-requests/:requestId/decline

POST   /networks/invite-link/generate
```

### User & Group Detail Endpoints

```
GET    /networks/users/:userId/profile
GET    /networks/users/:userId/transactions
GET    /networks/users/:userId/common-groups
GET    /networks/users/:userId/mutual-connections/:otherUserId

GET    /networks/groups/:groupId
GET    /networks/groups/:groupId/members
GET    /networks/groups/:groupId/media

GET    /networks/chats/:chatId/media
GET    /networks/chats/:chatId/links
GET    /networks/chats/:chatId/files

PATCH  /networks/users/:userId/mute
POST   /networks/users/:userId/report
POST   /networks/users/:userId/block
```

---

## 5. Implementation Checklist

### Phase 1: Core Messaging
- [ ] Chat model (1:1 + group support)
- [ ] Message model with attachments, reactions, threads
- [ ] Real-time message delivery (WebSocket integration with GetStream)
- [ ] Read receipts tracking
- [ ] Search across chat history

### Phase 2: Social Discovery
- [ ] Friend request system (send, accept, decline, list)
- [ ] Group request system (invite, join request, accept, decline)
- [ ] User discovery/search with location filtering
- [ ] Group discovery/search with member count
- [ ] Follow functionality

### Phase 3: User Context Integration
- [ ] Chat details view (user profile, transactions, content)
- [ ] Mute notifications per chat/user
- [ ] Block user functionality
- [ ] Report user functionality
- [ ] Message actions (reply, thread, edit, delete)

### Phase 4: Group Management (Batch 4 Part 2 likely)
- [ ] Create group
- [ ] Group settings (name, avatar, description)
- [ ] Invite members to group
- [ ] Remove members from group
- [ ] Group moderation (delete messages, ban users)
- [ ] Group media library

### Phase 5: Notifications & Presence
- [ ] Real-time typing indicators
- [ ] Online/offline status with last seen
- [ ] Unread badge aggregation
- [ ] Notification preferences per chat
- [ ] WebSocket connection management

---

## 6. Gaps & Decisions

### Identified Gaps

| Gap | Impact | Recommendation |
|-----|--------|-----------------|
| **GetStream Integration Status** | Unknown if already integrated in Batch 2 | Verify GetStream API keys and WebSocket setup before implementation |
| **File Upload Infrastructure** | Appears needed for message attachments | Confirm S3 bucket, CDN, and file size limits |
| **Rate Limiting** | No mention of rate limits for messaging | Implement per-user rate limits (100 msgs/min, 10 files/hour) |
| **Message Encryption** | No E2E encryption indicated | Clarify if messages stored in plaintext or encrypted |
| **Archival Strategy** | No mention of message retention | Define retention policy (keep forever, archive after 90 days?) |
| **Group vs Community** | Different from Collections (Batch 2) — need clear distinction | Groups are social communities; Collections are curated items |

### Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Unified Chat List** | Mix 1:1 + group chats in timeline sorted by activity; cleaner UX |
| **Message Tags** | "Inquiry", "Offer" tags help surface transaction context in chat |
| **Thread Support** | Allow sub-conversations without cluttering main chat |
| **Soft Delete** | Delete shows as placeholder rather than removing; preserves thread integrity |
| **Read Receipts** | Show single ✓ (sent), double ✓✓ (delivered), blue double ✓✓ (read) |
| **Invite Links** | Generate shareable URL to grow user base and build networks |

---

## 7. Known Context from Previous Batches

### Batch 2 (Networks)
- User onboarding with location, profile, verification
- Listings data model with detailed fields (description, price, location)
- Reviews system (post-transaction feedback)
- Followed collections feature

### Batch 3 (Listings)
- Listing creation, editing, deletion
- Offer/Inquiry workflows
- Message attachments (photos, documents)
- Bulk operations on listings

### Batch 4 Part 1 (Social Hub - Current)
- **Extends:** Batch 2 user model, Batch 3 offer/inquiry models
- **New:** Messaging system, group chats, friend/group requests, user discovery
- **Integration Points:** User profile, listing transactions, verification badges

---

## 8. Ready for Parts 2, 3, 4

This analysis covers Part 1 screens comprehensively.  
**Awaiting:** 
- Part 2 screens (likely group management, media library)
- Part 3 screens (likely notifications, settings, moderation)
- Part 4 screens (likely advanced features, analytics)

Will integrate findings across all parts into unified implementation guide once all parts received.

---

**Document Version:** 1.0  
**Last Updated:** April 6, 2026  
**Status:** Ready for development planning

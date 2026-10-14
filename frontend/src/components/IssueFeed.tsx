import IssueCard from "@/components/IssueCard";
import type { IssueStatus } from "@/components/StatusBadge";

import issueGarbage from "@/assets/issue-garbage.jpg";
import issuePothole from "@/assets/issue-pothole.jpg";
import issueWater from "@/assets/issue-water.jpg";
import issueStreetlight from "@/assets/issue-streetlight.jpg";
import issueDrainage from "@/assets/issue-drainage.jpg";
import issueFootpath from "@/assets/issue-footpath.jpg";

interface Issue {
  id: string;
  title: string;
  location: string;
  department: string;
  status: IssueStatus;
  image: string;
  upvotes: number;
  comments: number;
  reporters: number;
  daysAgo: number;
}

const mockIssues: Issue[] = [
  { id: "1", title: "Garbage Accumulation Near FC Road", location: "FC Road, Deccan, Pune", department: "Sanitation", status: "Pending", image: issueGarbage, upvotes: 47, comments: 12, reporters: 5, daysAgo: 2 },
  { id: "2", title: "Large Pothole on MG Road", location: "MG Road, Camp, Pune", department: "Roads & Infrastructure", status: "Ongoing", image: issuePothole, upvotes: 89, comments: 23, reporters: 12, daysAgo: 5 },
  { id: "3", title: "Water Pipe Burst Near Market", location: "Laxmi Road, Pune", department: "Water Supply", status: "Resolved", image: issueWater, upvotes: 34, comments: 8, reporters: 3, daysAgo: 10 },
  { id: "4", title: "Non-functional Street Lights", location: "Kothrud, Pune", department: "Electrical", status: "Escalated", image: issueStreetlight, upvotes: 62, comments: 15, reporters: 8, daysAgo: 9 },
  { id: "5", title: "Blocked Storm Drain Causing Flooding", location: "Hadapsar, Pune", department: "Drainage", status: "Pending", image: issueDrainage, upvotes: 51, comments: 19, reporters: 7, daysAgo: 1 },
  { id: "6", title: "Damaged Footpath Near School", location: "Aundh, Pune", department: "Roads & Infrastructure", status: "Ongoing", image: issueFootpath, upvotes: 28, comments: 6, reporters: 4, daysAgo: 4 },
];

const IssueFeed = () => (
  <section id="issues" className="civic-section bg-background">
    <div className="civic-container">
      <h2 className="mb-2 text-h2 text-foreground">Issues Around You</h2>
      <p className="mb-8 text-body-lg text-muted-foreground">
        Browse and upvote civic issues reported in your area.
      </p>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {mockIssues.map((issue) => (
          <IssueCard key={issue.id} issue={issue} />
        ))}
      </div>
    </div>
  </section>
);

export default IssueFeed;

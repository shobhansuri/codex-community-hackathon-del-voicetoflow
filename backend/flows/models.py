import uuid

from django.db import models


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Flow(TimeStampedModel):
    uuid = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    ai_context = models.TextField(blank=True)
    settings = models.JSONField(default=dict, blank=True)

    def __str__(self) -> str:
        return self.name


class FlowNode(TimeStampedModel):
    class NodeKind(models.TextChoices):
        START = 'start', 'Start'
        PROCESS = 'process', 'Process'
        DECISION = 'decision', 'Decision'
        MESSAGE = 'message', 'Message'
        NOTE = 'note', 'Note'
        TASK = 'task', 'Task'
        WAIT = 'wait', 'Wait'
        END = 'end', 'End'

    flow = models.ForeignKey(Flow, on_delete=models.CASCADE, related_name='nodes')
    node_id = models.CharField(max_length=120)
    kind = models.CharField(max_length=32, choices=NodeKind.choices)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    position_x = models.FloatField(default=0)
    position_y = models.FloatField(default=0)
    data = models.JSONField(default=dict, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['flow', 'node_id'],
                name='unique_flow_node_id',
            ),
        ]

    def __str__(self) -> str:
        return f'{self.flow_id}:{self.node_id}'


class FlowEdge(TimeStampedModel):
    flow = models.ForeignKey(Flow, on_delete=models.CASCADE, related_name='edges')
    edge_id = models.CharField(max_length=120)
    source_node_id = models.CharField(max_length=120)
    target_node_id = models.CharField(max_length=120)
    source_handle = models.CharField(max_length=120, blank=True)
    target_handle = models.CharField(max_length=120, blank=True)
    label = models.CharField(max_length=255, blank=True)
    condition = models.CharField(max_length=255, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['flow', 'edge_id'],
                name='unique_flow_edge_id',
            ),
        ]

    def __str__(self) -> str:
        return f'{self.source_node_id} -> {self.target_node_id}'


class NodeNote(TimeStampedModel):
    flow = models.ForeignKey(Flow, on_delete=models.CASCADE, related_name='notes')
    node = models.ForeignKey(
        FlowNode,
        on_delete=models.CASCADE,
        related_name='notes',
    )
    body = models.TextField()

    def __str__(self) -> str:
        return self.body[:80]


class FlowDoc(TimeStampedModel):
    flow = models.ForeignKey(Flow, on_delete=models.CASCADE, related_name='docs')
    node = models.ForeignKey(
        FlowNode,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='docs',
    )
    title = models.CharField(max_length=255)
    body = models.TextField(blank=True)

    def __str__(self) -> str:
        return self.title


class Task(TimeStampedModel):
    class Status(models.TextChoices):
        TODO = 'todo', 'Todo'
        IN_PROGRESS = 'in_progress', 'In progress'
        DONE = 'done', 'Done'
        CANCELLED = 'cancelled', 'Cancelled'

    flow = models.ForeignKey(Flow, on_delete=models.CASCADE, related_name='tasks')
    node = models.ForeignKey(
        FlowNode,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='tasks',
    )
    note = models.ForeignKey(
        NodeNote,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='tasks',
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    assignee = models.CharField(max_length=120, blank=True)
    channel = models.CharField(max_length=80, blank=True)
    status = models.CharField(
        max_length=32,
        choices=Status.choices,
        default=Status.TODO,
    )
    metadata = models.JSONField(default=dict, blank=True)

    def __str__(self) -> str:
        return self.title


class NodeAction(TimeStampedModel):
    flow = models.ForeignKey(Flow, on_delete=models.CASCADE, related_name='actions')
    node = models.ForeignKey(
        FlowNode,
        on_delete=models.CASCADE,
        related_name='actions',
    )
    action_type = models.CharField(max_length=80)
    config = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=32, default='draft')

    def __str__(self) -> str:
        return f'{self.action_type}:{self.status}'
